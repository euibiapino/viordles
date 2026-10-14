const { spawn } = require('child_process');
const metrics = require('../observability/metrics');
const log = require('./logger');
const { matchesMusic, normalizeMusicQuery } = require('./musicLookup');
const { LRUCache } = require('lru-cache');
const CACHE_TTL_MS = 20 * 60_000;
const resolvedCache = new LRUCache({ max: 100, ttl: CACHE_TTL_MS });
const pending = new Map();

const YTDLP_BIN = process.env.YTDLP_BIN || '/usr/local/bin/yt-dlp';
const YTDLP_PROXY = process.env.YTDLP_PROXY || 'socks5://localhost:40000';
const FORMAT = 'bestaudio[ext=m4a]/bestaudio[acodec=opus]/bestaudio';

const { ResolverWorker } = require('./ytdlpWorker');
const worker = new ResolverWorker(YTDLP_BIN, YTDLP_PROXY, FORMAT);
const workerEnabled = process.env.YTDLP_WORKER !== 'false';
function startResolverWorker() {
  if (workerEnabled)
    Promise.resolve()
      .then(() => worker.start())
      .catch(() => {});
}
function stopResolverWorker() {
  worker.stop();
}

function runYtdlp(args, { timeoutMs = 30_000 } = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(YTDLP_BIN, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error('yt-dlp timeout'));
    }, timeoutMs);

    proc.stdout.on('data', (d) => {
      stdout += d;
    });
    proc.stderr.on('data', (d) => {
      stderr += d;
    });
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(stderr.trim() || `yt-dlp exited with code ${code}`));
      resolve(stdout);
    });
    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function baseArgs() {
  const args = ['--no-warnings', '--no-playlist', '-f', FORMAT];
  if (YTDLP_PROXY) args.push('--proxy', YTDLP_PROXY);
  return args;
}

function cacheResult(key, result) {
  const expires = Number(new URL(result.streamUrl).searchParams.get('expire')) * 1000;
  const ttl = expires ? Math.min(CACHE_TTL_MS, expires - Date.now() - 60_000) : 120_000;
  if (ttl > 0) resolvedCache.set(key, result, { ttl });
}

function normalize(info) {
  if (!info?.url) return null;
  return {
    streamUrl: info.url,
    title: info.title ?? 'Unknown',
    author: info.uploader ?? info.channel ?? info.artist ?? 'Unknown',
    cleanTitle: info.track ?? null,
    cleanArtist: info.artist ?? info.creator ?? null,
    album: info.album ?? null,
    duration: Math.round((info.duration ?? 0) * 1000),
    thumbnail: info.thumbnail ?? info.thumbnails?.at(-1)?.url ?? null,
    sourceUrl: info.webpage_url ?? info.original_url ?? null,
    sourceName: 'youtube',
  };
}

async function resolveUncached(query) {
  if (workerEnabled) {
    try {
      const result = normalize(await worker.resolve(query));
      if (result) return result;
    } catch {
      // Mesmo caminho convencional que já funcionava antes do worker.
    }
  }
  const args = [...baseArgs(), '--dump-single-json'];
  const isUrl = /^https?:\/\//.test(query);
  args.push(isUrl ? query : `ytsearch1:${query}`);

  const stdout = await runYtdlp(args);
  const data = JSON.parse(stdout);
  const info = data.entries?.[0] ?? data;
  return normalize(info);
}

async function resolveOne(query, { refresh = false } = {}) {
  const key = normalizeMusicQuery(query);
  if (refresh) resolvedCache.delete(key);
  const cached = resolvedCache.get(key);
  if (cached) {
    metrics.cache.inc({ cache: 'resolver', result: 'hit' });
    return { ...cached };
  }
  if (pending.has(key)) {
    const result = await pending.get(key);
    return result ? { ...result } : null;
  }
  metrics.cache.inc({ cache: 'resolver', result: 'miss' });
  const task = metrics
    .measure('resolve', () => resolveUncached(key))
    .then((result) => {
      if (result) cacheResult(key, result);
      return result;
    })
    .catch((error) => {
      if (/confirm your age|age.restricted/i.test(error.message)) error.code = 'AGE_RESTRICTED';
      else if (/sign in|private video|authentication|login required/i.test(error.message))
        error.code = 'AUTH_REQUIRED';
      log.warn('Resolução de áudio falhou:', {
        code: error.code || 'EXTRACTION_FAILED',
        message: error.message,
      });
      throw error;
    })
    .finally(() => pending.delete(key));
  pending.set(key, task);
  const result = await task;
  return result ? { ...result } : null;
}

async function resolveSpotifyAudio(meta) {
  const query = `${meta.author} ${meta.title}`;
  let failure;
  try {
    const first = await resolveOne(query);
    if (first && matchesMusic(first, meta)) return first;
  } catch (error) {
    failure = error;
  }

  // Uma busca completa pode vir vazia. Buscar candidatos com menos termos,
  // mas só aceitar depois de conferir todos os dados da faixa original.
  const titleWords = meta.title
    .replace(/[([][^)\]]*[)\]]/g, '')
    .trim()
    .split(/\s+/);
  const alternate = `${meta.author.split(',')[0]} ${titleWords.slice(-2).join(' ')}`;
  let candidates;
  try {
    const output = await runYtdlp([
      ...baseArgs(),
      '--flat-playlist',
      '--dump-single-json',
      `ytsearch5:${alternate}`,
    ]);
    candidates = JSON.parse(output).entries || [];
  } catch (error) {
    throw failure || error;
  }
  for (const candidate of candidates
    .filter(
      (item) => item && matchesMusic({ ...item, duration: (item.duration || 0) * 1000 }, meta),
    )
    .slice(0, 3)) {
    try {
      const resolved = await resolveOne(candidate.url);
      if (resolved && matchesMusic(resolved, meta)) {
        cacheResult(normalizeMusicQuery(query), resolved);
        return resolved;
      }
    } catch (error) {
      failure = error;
    }
  }
  if (failure) throw failure;
  return null;
}

async function resolvePlaylist(url) {
  const args = [
    ...baseArgs().filter((a) => a !== '--no-playlist'),
    '--flat-playlist',
    '--dump-single-json',
    url,
  ];
  const stdout = await runYtdlp(args, { timeoutMs: 60_000 });
  const data = JSON.parse(stdout);
  const entries = data.entries ?? [];
  return {
    name: data.title ?? 'Playlist',
    tracks: entries.map((e) => ({
      query: e.url ?? e.id,
      title: e.title ?? 'Unknown',
      author: e.uploader ?? data.uploader ?? 'Unknown',
      duration: Math.round((e.duration ?? 0) * 1000),
      thumbnail: e.thumbnails?.at(-1)?.url ?? null,
      sourceUrl: e.url ?? null,
    })),
  };
}

function isYoutubePlaylist(url) {
  return /[?&]list=/.test(url) && !/[?&]v=/.test(url);
}

module.exports = {
  resolveOne,
  resolveSpotifyAudio,
  startResolverWorker,
  stopResolverWorker,
  resolvePlaylist,
  isYoutubePlaylist,
};

const { spawn } = require('child_process');

const YTDLP_BIN = process.env.YTDLP_BIN || '/usr/local/bin/yt-dlp';
const YTDLP_PROXY = process.env.YTDLP_PROXY || 'socks5://localhost:40000';
const FORMAT = 'bestaudio[ext=m4a]/bestaudio[acodec=opus]/bestaudio';

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

async function resolveOne(query) {
  const args = [...baseArgs(), '--dump-single-json'];
  const isUrl = /^https?:\/\//.test(query);
  args.push(isUrl ? query : `ytsearch1:${query}`);

  const stdout = await runYtdlp(args);
  const data = JSON.parse(stdout);
  const info = data.entries?.[0] ?? data;
  return normalize(info);
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
  resolvePlaylist,
  isYoutubePlaylist,
};

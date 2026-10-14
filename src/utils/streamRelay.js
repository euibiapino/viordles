const http = require('http');
const https = require('https');
const { LRUCache } = require('lru-cache');
const { SocksProxyAgent } = require('socks-proxy-agent');
const log = require('./logger');
const metrics = require('../observability/metrics');

// O googlevideo só entrega essas URLs assinadas para requisições com Range
// delimitado: um GET sem Range volta 403 e um Range aberto (`bytes=0-`) volta 302
// para um host que também nega. O lavaplayer nunca manda Range na posição 0, então
// o Lavalink sozinho não consegue ler nada do YouTube resolvido pelo yt-dlp.
//
// Este relay fica entre os dois: recebe a requisição do Lavalink, busca o upstream
// em faixas delimitadas e devolve tudo como um stream contínuo. A ida ao googlevideo
// passa pelo mesmo proxy WARP que o yt-dlp usou, porque a URL é travada no IP de
// saída que a assinou.
const CHUNK_SIZE = 256 * 1024;
const FIRST_CHUNK_SIZE = 64 * 1024;
const audioCache = new LRUCache({
  maxSize: 24 * 1024 * 1024,
  sizeCalculation: (buffer) => buffer.length,
  ttl: 5 * 60_000,
});
const ALLOWED_HOST = /(^|\.)googlevideo\.com$/;
const UPSTREAM_TIMEOUT_MS = 20_000;
const UPSTREAM_RETRIES = 2;
const PORT = Number(process.env.MUSIC_RELAY_PORT || 2444);
const PROXY = process.env.YTDLP_PROXY || 'socks5://localhost:40000';

let server = null;
let agent = null;

function proxyAgent() {
  // socks5h resolve o DNS do lado do WARP, para cair no mesmo edge que assinou a URL.
  if (!agent)
    agent = new SocksProxyAgent(PROXY.replace(/^socks5:\/\//, 'socks5h://'), {
      keepAlive: true,
      maxSockets: 12,
      maxFreeSockets: 4,
    });
  return agent;
}

function parseRange(header) {
  const m = /^bytes=(\d+)-(\d*)$/.exec(String(header ?? ''));
  if (!m) return null;
  return { start: Number(m[1]), end: m[2] === '' ? null : Number(m[2]) };
}

function validateTarget(url) {
  const parsed = new URL(url);
  if (
    parsed.protocol !== 'https:' ||
    !ALLOWED_HOST.test(parsed.hostname) ||
    parsed.username ||
    parsed.password ||
    (parsed.port && parsed.port !== '443')
  ) {
    throw new Error('destino de áudio inválido');
  }
  return parsed;
}

function fetchChunk(url, start, end, signal) {
  validateTarget(url);
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        agent: proxyAgent(),
        signal,
        headers: { Range: `bytes=${start}-${end}` },
      },
      resolve,
    );
    req.on('error', reject);
    req.setTimeout(UPSTREAM_TIMEOUT_MS, () => req.destroy(new Error('timeout no upstream')));
    req.end();
  });
}

async function fetchChunkWithRetry(url, start, end, signal) {
  let lastErr;
  for (let attempt = 0; attempt <= UPSTREAM_RETRIES; attempt++) {
    let current = url;
    try {
      for (let hop = 0; hop <= 5; hop++) {
        const res = await fetchChunk(current, start, end, signal);
        if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
          metrics.relay.inc({ event: 'redirect' });
          const location = res.headers.location;
          res.destroy();
          if (!location || hop === 5) throw new Error('redirecionamento inválido ou excessivo');
          current = validateTarget(new URL(location, current).href).href;
          continue;
        }
        if (res.statusCode === 206) return res;
        res.destroy();
        throw new Error(`upstream respondeu ${res.statusCode}`);
      }
    } catch (e) {
      if (signal?.aborted) throw e;
      metrics.relay.inc({ event: 'retry' });
      lastErr = e;
    }
  }
  throw lastErr;
}

// Valida e termina uma faixa antes de entregá-la ao Lavalink. Se a conexão
// cair no corpo, repetir a faixa não duplica bytes já enviados ao player.
async function readChunk(url, start, end, total, signal) {
  let lastErr;
  for (let attempt = 0; attempt <= UPSTREAM_RETRIES; attempt++) {
    let upstream;
    try {
      upstream = await fetchChunkWithRetry(url, start, end, signal);
      const range = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(upstream.headers['content-range'] || '');
      if (
        !range ||
        Number(range[1]) !== start ||
        Number(range[2]) > end ||
        Number(range[2]) < start ||
        Number(range[3]) !== total
      ) {
        throw new Error('Content-Range inesperado no áudio');
      }
      const expected = Number(range[2]) - start + 1;
      const buffers = [];
      let size = 0;
      for await (const buffer of upstream) {
        size += buffer.length;
        if (size > expected) throw new Error('faixa de áudio maior que o anunciado');
        buffers.push(buffer);
      }
      if (size !== expected) throw new Error('faixa de áudio truncada');
      return Buffer.concat(buffers, size);
    } catch (e) {
      if (signal?.aborted) throw e;
      metrics.relay.inc({ event: 'retry' });
      lastErr = e;
    } finally {
      upstream?.destroy();
    }
  }
  throw lastErr;
}

// O clen vem na própria URL assinada; só sondamos o upstream se ele faltar.
async function resolveTotalLength(url) {
  const clen = Number(new URL(url).searchParams.get('clen'));
  if (Number.isFinite(clen) && clen > 0) return clen;

  const probe = await fetchChunkWithRetry(url, 0, 0);
  probe.destroy();
  const total = Number(/\/(\d+)$/.exec(probe.headers['content-range'] ?? '')?.[1]);
  if (!Number.isFinite(total) || total <= 0) throw new Error('upstream não informou o tamanho');
  return total;
}

function writeBuffer(res, buffer) {
  return new Promise((resolve, reject) => {
    const closed = () => reject(new Error('cliente desconectado'));
    res.once('close', closed);
    res.write(buffer, (error) => {
      res.off('close', closed);
      if (error) reject(error);
      else resolve();
    });
  });
}

// Blocos alinhados são reutilizados entre a sondagem do Lavalink, playback
// e seek. Apenas blocos completos e validados entram no cache limitado.
async function getBlock(url, start, total, signal, reader = readChunk) {
  const boundary =
    start === 0 ? FIRST_CHUNK_SIZE : (Math.floor(start / CHUNK_SIZE) + 1) * CHUNK_SIZE;
  const end = Math.min(boundary - 1, total - 1);
  const key = `${url}|${start}|${total}`;
  const cached = audioCache.get(key);
  if (cached) {
    metrics.cache.inc({ cache: 'audio', result: 'hit' });
    return cached;
  }
  metrics.cache.inc({ cache: 'audio', result: 'miss' });
  const started = performance.now();
  const buffers = [];
  let position = start;
  while (position <= end) {
    if (signal?.aborted) throw new Error('leitura cancelada');
    const buffer = await metrics.measure('relay_block', () =>
      reader(url, position, end, total, signal),
    );
    if (!buffer.length || buffer.length > end - position + 1) throw new Error('bloco inválido');
    buffers.push(buffer);
    position += buffer.length;
  }
  const buffer = Buffer.concat(buffers);
  const elapsedMs = Math.round(performance.now() - started);
  if (elapsedMs > 5000)
    log.warn('Leitura de áudio lenta:', { offset: start, bytes: buffer.length, elapsedMs });
  audioCache.set(key, buffer);
  return buffer;
}

async function pump(url, start, last, total, res, signal) {
  let blockStart =
    start < FIRST_CHUNK_SIZE
      ? 0
      : start < CHUNK_SIZE
        ? FIRST_CHUNK_SIZE
        : Math.floor(start / CHUNK_SIZE) * CHUNK_SIZE;
  // Capturar o erro imediatamente evita rejection sem handler se o cliente
  // desconectar enquanto o próximo bloco está sendo antecipado.
  const prepare = (offset) =>
    getBlock(url, offset, total, signal).then(
      (buffer) => ({ buffer }),
      (error) => ({ error }),
    );
  let pending = prepare(blockStart);
  while (blockStart <= last && !signal.aborted) {
    const { buffer, error } = await pending;
    if (error) throw error;
    if (signal.aborted) return;
    const next = blockStart + buffer.length;
    if (next <= last) pending = prepare(next);
    await writeBuffer(
      res,
      buffer.subarray(
        Math.max(0, start - blockStart),
        Math.min(buffer.length, last - blockStart + 1),
      ),
    );
    blockStart = next;
  }
  if (!signal.aborted) res.end();
}

async function handle(req, res) {
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.writeHead(405).end();
    return;
  }
  const target = new URL(req.url, 'http://127.0.0.1').searchParams.get('u');
  if (!target) {
    res.writeHead(400).end();
    return;
  }

  let upstreamUrl;
  try {
    upstreamUrl = validateTarget(target);
  } catch {
    res.writeHead(400).end();
    return;
  }
  // O relay escuta só em loopback, mas restringir o destino evita que ele vire
  // um proxy de saída genérico caso algum dia seja exposto.
  if (upstreamUrl.protocol !== 'https:' || !ALLOWED_HOST.test(upstreamUrl.hostname)) {
    res.writeHead(403).end();
    return;
  }

  const total = await resolveTotalLength(target);
  const range = parseRange(req.headers.range);
  if (
    (req.headers.range && !range) ||
    (range &&
      (!Number.isSafeInteger(range.start) ||
        range.start >= total ||
        (range.end !== null && (!Number.isSafeInteger(range.end) || range.end < range.start))))
  ) {
    res.writeHead(416, { 'Content-Range': `bytes */${total}` }).end();
    return;
  }
  const start = range?.start ?? 0;
  const last = Math.min(range?.end ?? total - 1, total - 1);

  const headers = {
    'Content-Type': upstreamUrl.searchParams.get('mime') || 'audio/mp4',
    'Content-Length': last - start + 1,
    'Accept-Ranges': 'bytes',
  };
  if (range) headers['Content-Range'] = `bytes ${start}-${last}/${total}`;
  res.writeHead(range ? 206 : 200, headers);

  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  const controller = new AbortController();
  const abort = () => controller.abort();
  res.once('close', abort);
  try {
    await pump(target, start, last, total, res, controller.signal);
  } finally {
    controller.abort();
    res.off('close', abort);
  }
}

// Pular ou parar a música faz o Lavalink cortar a conexão no meio do stream.
// É o fluxo normal, não uma falha — logar como erro só afogaria o log real.
function isClientAbort(res) {
  return res.destroyed;
}

function startRelay() {
  if (server) return;
  server = http.createServer((req, res) => {
    const rid = new URL(req.url, 'http://localhost').searchParams.get('rid');
    const context = /^[a-f0-9-]{36}$/.test(rid || '') ? { requestId: rid } : {};
    log
      .withContext(context, () => handle(req, res))
      .catch((e) => {
        if (!isClientAbort(res, e)) {
          metrics.relay.inc({ event: 'failure' });
          log.withContext(context, () => log.error('Relay de áudio falhou:', e.message));
          if (!res.headersSent) res.writeHead(502);
        }
        res.destroy();
      });
  });
  // Os defaults do Node cortariam faixas longas no meio da música.
  server.timeout = 0;
  server.requestTimeout = 0;
  server.listen(PORT, '127.0.0.1', () => log.info(`Relay de áudio em 127.0.0.1:${PORT}`));
}

function stopRelay() {
  return new Promise((resolve) => (server ? server.close(() => resolve()) : resolve()));
}

function relayUrl(streamUrl) {
  return `http://127.0.0.1:${PORT}/stream?u=${encodeURIComponent(streamUrl)}&rid=${encodeURIComponent(log.context().requestId || '')}`;
}

module.exports = { startRelay, stopRelay, relayUrl, readChunk, handle, getBlock };

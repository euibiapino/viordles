const http = require('http');
const https = require('https');
const { once } = require('events');
const { SocksProxyAgent } = require('socks-proxy-agent');
const log = require('./logger');

// O googlevideo só entrega essas URLs assinadas para requisições com Range
// delimitado: um GET sem Range volta 403 e um Range aberto (`bytes=0-`) volta 302
// para um host que também nega. O lavaplayer nunca manda Range na posição 0, então
// o Lavalink sozinho não consegue ler nada do YouTube resolvido pelo yt-dlp.
//
// Este relay fica entre os dois: recebe a requisição do Lavalink, busca o upstream
// em faixas delimitadas e devolve tudo como um stream contínuo. A ida ao googlevideo
// passa pelo mesmo proxy WARP que o yt-dlp usou, porque a URL é travada no IP de
// saída que a assinou.
const CHUNK_SIZE = 1 << 20;
const ALLOWED_HOST = /(^|\.)googlevideo\.com$/;
const UPSTREAM_TIMEOUT_MS = 20_000;
const UPSTREAM_RETRIES = 2;
const PORT = Number(process.env.MUSIC_RELAY_PORT || 2444);
const PROXY = process.env.YTDLP_PROXY || 'socks5://localhost:40000';

let server = null;
let agent = null;

function proxyAgent() {
  // socks5h resolve o DNS do lado do WARP, para cair no mesmo edge que assinou a URL.
  if (!agent) agent = new SocksProxyAgent(PROXY.replace(/^socks5:\/\//, 'socks5h://'));
  return agent;
}

function parseRange(header) {
  const m = /^bytes=(\d+)-(\d*)$/.exec(String(header ?? ''));
  if (!m) return null;
  return { start: Number(m[1]), end: m[2] === '' ? null : Number(m[2]) };
}

function fetchChunk(url, start, end) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      { agent: proxyAgent(), headers: { Range: `bytes=${start}-${end}` } },
      resolve,
    );
    req.on('error', reject);
    req.setTimeout(UPSTREAM_TIMEOUT_MS, () => req.destroy(new Error('timeout no upstream')));
    req.end();
  });
}

async function fetchChunkWithRetry(url, start, end) {
  let lastErr = null;
  for (let attempt = 0; attempt <= UPSTREAM_RETRIES; attempt++) {
    try {
      const res = await fetchChunk(url, start, end);
      if (res.statusCode >= 200 && res.statusCode < 300) return res;
      res.resume();
      lastErr = new Error(`upstream respondeu ${res.statusCode}`);
    } catch (e) {
      lastErr = e;
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

async function pump(url, start, last, res) {
  let pos = start;
  while (pos <= last && !res.destroyed) {
    const upstream = await fetchChunkWithRetry(url, pos, Math.min(pos + CHUNK_SIZE - 1, last));
    for await (const buf of upstream) {
      if (res.destroyed) {
        upstream.destroy();
        return;
      }
      pos += buf.length;
      if (!res.write(buf)) await once(res, 'drain');
    }
  }
  res.end();
}

async function handle(req, res) {
  const target = new URL(req.url, 'http://127.0.0.1').searchParams.get('u');
  if (!target) {
    res.writeHead(400).end();
    return;
  }

  let upstreamUrl;
  try {
    upstreamUrl = new URL(target);
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
  const start = Math.min(range?.start ?? 0, total - 1);
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
  await pump(target, start, last, res);
}

function startRelay() {
  if (server) return;
  server = http.createServer((req, res) => {
    handle(req, res).catch((e) => {
      log.error('Relay de áudio falhou:', e.message);
      if (!res.headersSent) res.writeHead(502);
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
  return `http://127.0.0.1:${PORT}/stream?u=${encodeURIComponent(streamUrl)}`;
}

module.exports = { startRelay, stopRelay, relayUrl };

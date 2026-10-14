const { LRUCache } = require('lru-cache');

const MAX_BYTES = 8 * 1024 * 1024;
const cache = new LRUCache({
  maxSize: 24 * 1024 * 1024,
  sizeCalculation: (v) => v.attachment.length,
  ttl: 3600_000,
});

function imageExtension(buffer) {
  if (['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString())) return 'gif';
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'png';
  if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) return 'jpg';
  if (buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP')
    return 'webp';
  throw new Error('o arquivo não é GIF, PNG, JPEG ou WebP');
}

async function loadWelcomeImage(url) {
  if (cache.has(url)) return cache.get(url);
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') throw new Error('a imagem precisa usar HTTPS');
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok || !res.headers.get('content-type')?.startsWith('image/')) {
    await res.body?.cancel();
    throw new Error(`imagem indisponível (HTTP ${res.status})`);
  }
  if (Number(res.headers.get('content-length')) > MAX_BYTES) {
    await res.body?.cancel();
    throw new Error('a imagem ultrapassa 8 MiB');
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of res.body) {
    size += chunk.length;
    if (size > MAX_BYTES) throw new Error('a imagem ultrapassa 8 MiB');
    chunks.push(chunk);
  }
  const attachment = Buffer.concat(chunks, size);
  const result = { attachment, name: `boas-vindas.${imageExtension(attachment)}` };
  cache.set(url, result);
  return result;
}

module.exports = { loadWelcomeImage, imageExtension };

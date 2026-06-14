const { LRUCache } = require('lru-cache');

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_SEARCH_URL = 'https://api.spotify.com/v1/search';

let cachedToken = null;
let tokenExpiresAt = 0;

const searchCache = new LRUCache({ max: 300, ttl: 1000 * 60 * 60 * 24 });

async function getToken() {
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) return cachedToken;

  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) throw new Error('Spotify credentials missing');

  const basic = Buffer.from(`${id}:${secret}`).toString('base64');
  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error(`Spotify token failed: ${res.status}`);
  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + data.expires_in * 1000;
  return cachedToken;
}

async function searchTrack(query) {
  const key = query.toLowerCase();
  if (searchCache.has(key)) return searchCache.get(key);

  const token = await getToken();
  const url = `${SPOTIFY_SEARCH_URL}?q=${encodeURIComponent(query)}&type=track&limit=1`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const data = await res.json();
  const t = data.tracks?.items?.[0];
  if (!t) {
    searchCache.set(key, null);
    return null;
  }
  const result = {
    title: t.name,
    author: t.artists.map((a) => a.name).join(', '),
    duration: t.duration_ms,
    uri: t.external_urls.spotify,
    artworkUrl: t.album?.images?.[0]?.url ?? null,
    sourceName: 'spotify',
  };
  searchCache.set(key, result);
  return result;
}

module.exports = { searchTrack };

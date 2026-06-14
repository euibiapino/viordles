const axios = require('axios');
const { LRUCache } = require('lru-cache');
const log = require('./logger');

const cache = new LRUCache({ max: 100, ttl: 1000 * 60 * 60 * 24 });

async function searchGame(title) {
  const key = title.toLowerCase();
  if (cache.has(key)) return cache.get(key);

  try {
    const response = await axios.get('https://api.rawg.io/api/games', {
      params: { key: process.env.RAWG_API_KEY, search: title, page_size: 1 },
      timeout: 5000,
    });
    const url = response.data.results[0]?.background_image || null;
    cache.set(key, url);
    return url;
  } catch (err) {
    log.error(`RAWG error for "${title}":`, err.message);
    return null;
  }
}

module.exports = { searchGame };

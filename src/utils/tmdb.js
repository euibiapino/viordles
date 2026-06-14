const axios = require('axios');
const { LRUCache } = require('lru-cache');
const log = require('./logger');

const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

const cache = new LRUCache({ max: 200, ttl: 1000 * 60 * 60 * 6 });

async function searchMedia(title, mediaType = 'movie') {
  const key = `${mediaType}:${title.toLowerCase()}`;
  if (cache.has(key)) return cache.get(key);

  try {
    const endpoint = mediaType === 'movie' ? '/search/movie' : '/search/tv';

    const response = await axios.get(`${BASE_URL}${endpoint}`, {
      params: {
        api_key: process.env.TMDB_API_KEY,
        query: title,
        language: 'pt-BR',
      },
      timeout: 5000,
    });

    const result = response.data.results[0];
    if (!result) {
      cache.set(key, null);
      return null;
    }

    const releaseDate = result.release_date || result.first_air_date;
    const data = {
      title: result.title || result.name,
      originalTitle: result.original_title || result.original_name || null,
      poster: result.poster_path ? `${IMAGE_BASE}${result.poster_path}` : null,
      overview: result.overview,
      year: releaseDate ? releaseDate.substring(0, 4) : null,
    };
    cache.set(key, data);
    return data;
  } catch (err) {
    log.error(`TMDB error for "${title}":`, err.message);
    return null;
  }
}

module.exports = { searchMedia };

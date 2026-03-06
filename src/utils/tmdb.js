const axios = require('axios');

const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

async function searchMedia(title, mediaType = 'movie') {
  try {
    const endpoint = mediaType === 'movie' ? '/search/movie' : '/search/tv';

    const response = await axios.get(`${BASE_URL}${endpoint}`, {
      params: {
        api_key: process.env.TMDB_API_KEY,
        query: title,
        language: 'pt-BR',
      },
    });

    const result = response.data.results[0];
    if (!result) return null;

    const displayTitle = result.title || result.name;
    const releaseDate = result.release_date || result.first_air_date;

    return {
      title: displayTitle,
      poster: result.poster_path ? `${IMAGE_BASE}${result.poster_path}` : null,
      overview: result.overview,
      year: releaseDate ? releaseDate.substring(0, 4) : null,
    };
  } catch {
    return null;
  }
}

module.exports = { searchMedia };

const axios = require('axios');

const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

async function searchMovie(title) {
  try {
    const response = await axios.get(`${BASE_URL}/search/movie`, {
      params: {
        api_key: process.env.TMDB_API_KEY,
        query: title,
        language: 'pt-BR',
      },
    });

    const movie = response.data.results[0];
    if (!movie) return null;

    return {
      title: movie.title,
      poster: movie.poster_path ? `${IMAGE_BASE}${movie.poster_path}` : null,
      overview: movie.overview,
      year: movie.release_date ? movie.release_date.substring(0, 4) : null,
    };
  } catch {
    return null;
  }
}

module.exports = { searchMovie };

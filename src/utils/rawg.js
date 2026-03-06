const axios = require('axios');

async function searchGame(title) {
  try {
    const response = await axios.get('https://api.rawg.io/api/games', {
      params: { key: process.env.RAWG_API_KEY, search: title, page_size: 1 },
    });
    const result = response.data.results[0];
    return result?.background_image || null;
  } catch {
    return null;
  }
}

module.exports = { searchGame };

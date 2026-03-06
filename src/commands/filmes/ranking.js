const { executeRanking } = require('../../utils/mediaHandler');
const CONFIG = { type: 'filme', label: 'Filme', labelPlural: 'Filmes', emoji: '🎬', tmdbType: 'movie', cmdSugerir: 'sugerir', cmdAssistido: 'assistido', cmdAvaliar: 'avaliar' };
module.exports = { name: 'rankingfilmes', description: 'Ranking dos filmes mais bem avaliados', usage: '!rankingfilmes', async execute(message, args) { return executeRanking(message, args, CONFIG); } };

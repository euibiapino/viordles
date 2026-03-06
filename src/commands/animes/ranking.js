const { executeRanking } = require('../../utils/mediaHandler');
const CONFIG = { type: 'anime', label: 'Anime', labelPlural: 'Animes', emoji: '⛩️', tmdbType: 'tv', cmdSugerir: 'sugeriranime', cmdAssistido: 'assistidoanime', cmdAvaliar: 'avaliaranime' };
module.exports = { name: 'rankinganime', description: 'Ranking dos animes mais bem avaliados', usage: '!rankinganime', async execute(message, args) { return executeRanking(message, args, CONFIG); } };

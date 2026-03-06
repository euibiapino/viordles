const { executeRanking } = require('../../utils/mediaHandler');
const CONFIG = { type: 'animacao', label: 'Animacao', labelPlural: 'Animacoes', emoji: '🎠', tmdbType: 'movie', cmdSugerir: 'sugeriranim', cmdAssistido: 'assistidoanim', cmdAvaliar: 'avaliaranim' };
module.exports = { name: 'rankinganim', description: 'Ranking das animacoes mais bem avaliadas', usage: '!rankinganim', async execute(message, args) { return executeRanking(message, args, CONFIG); } };

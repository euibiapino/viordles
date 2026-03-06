const { executeListar } = require('../../utils/mediaHandler');
const CONFIG = { type: 'filme', label: 'Filme', labelPlural: 'Filmes', emoji: '🎬', tmdbType: 'movie', cmdSugerir: 'sugerir', cmdAssistido: 'assistido', cmdAvaliar: 'avaliar' };
module.exports = { name: 'filmes', description: 'Lista os filmes pendentes', usage: '!filmes', async execute(message, args) { return executeListar(message, args, CONFIG); } };

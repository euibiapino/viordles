const { executeVotar } = require('../../utils/mediaHandler');
const CONFIG = { type: 'filme', label: 'Filme', labelPlural: 'Filmes', emoji: '🎬', tmdbType: 'movie', cmdSugerir: 'sugerir', cmdAssistido: 'assistido', cmdAvaliar: 'avaliar' };
module.exports = { name: 'votar', description: 'Cria uma votacao com os filmes pendentes', usage: '!votar', async execute(message, args) { return executeVotar(message, args, CONFIG); } };

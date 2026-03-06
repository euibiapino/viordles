const { executeAvaliar } = require('../../utils/mediaHandler');
const CONFIG = { type: 'filme', label: 'Filme', labelPlural: 'Filmes', emoji: '🎬', tmdbType: 'movie', cmdSugerir: 'sugerir', cmdAssistido: 'assistido', cmdAvaliar: 'avaliar' };
module.exports = { name: 'avaliar', description: 'Avalia um filme (0-10)', usage: '!avaliar <nome> <nota>', async execute(message, args) { return executeAvaliar(message, args, CONFIG); } };

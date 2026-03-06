const { executeSugerir } = require('../../utils/mediaHandler');
const CONFIG = { type: 'filme', label: 'Filme', labelPlural: 'Filmes', emoji: '🎬', tmdbType: 'movie', cmdSugerir: 'sugerir', cmdAssistido: 'assistido', cmdAvaliar: 'avaliar' };
module.exports = { name: 'sugerir', description: 'Sugere um filme para a lista', usage: '!sugerir <nome>', async execute(message, args) { return executeSugerir(message, args, CONFIG); } };

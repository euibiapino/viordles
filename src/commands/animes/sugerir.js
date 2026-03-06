const { executeSugerir } = require('../../utils/mediaHandler');
const CONFIG = { type: 'anime', label: 'Anime', labelPlural: 'Animes', emoji: '⛩️', tmdbType: 'tv', cmdSugerir: 'sugeriranime', cmdAssistido: 'assistidoanime', cmdAvaliar: 'avaliaranime' };
module.exports = { name: 'sugeriranime', description: 'Sugere um anime para a lista', usage: '!sugeriranime <nome>', async execute(message, args) { return executeSugerir(message, args, CONFIG); } };

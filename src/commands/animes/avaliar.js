const { executeAvaliar } = require('../../utils/mediaHandler');
const CONFIG = { type: 'anime', label: 'Anime', labelPlural: 'Animes', emoji: '⛩️', tmdbType: 'tv', cmdSugerir: 'sugeriranime', cmdAssistido: 'assistidoanime', cmdAvaliar: 'avaliaranime' };
module.exports = { name: 'avaliaranime', description: 'Avalia um anime (0-10)', usage: '!avaliaranime <nome> <nota>', async execute(message, args) { return executeAvaliar(message, args, CONFIG); } };

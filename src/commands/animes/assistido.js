const { executeAssistido } = require('../../utils/mediaHandler');
const CONFIG = { type: 'anime', label: 'Anime', labelPlural: 'Animes', emoji: '⛩️', tmdbType: 'tv', cmdSugerir: 'sugeriranime', cmdAssistido: 'assistidoanime', cmdAvaliar: 'avaliaranime' };
module.exports = { name: 'assistidoanime', description: 'Marca um anime como assistido', usage: '!assistidoanime <nome>', async execute(message, args) { return executeAssistido(message, args, CONFIG); } };

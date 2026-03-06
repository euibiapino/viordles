const { executeListar } = require('../../utils/mediaHandler');
const CONFIG = { type: 'anime', label: 'Anime', labelPlural: 'Animes', emoji: '⛩️', tmdbType: 'tv', cmdSugerir: 'sugeriranime', cmdAssistido: 'assistidoanime', cmdAvaliar: 'avaliaranime' };
module.exports = { name: 'animes', description: 'Lista os animes pendentes', usage: '!animes [pagina]', async execute(message, args) { return executeListar(message, args, CONFIG); } };

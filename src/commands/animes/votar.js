const { executeVotar } = require('../../utils/mediaHandler');
const CONFIG = { type: 'anime', label: 'Anime', labelPlural: 'Animes', emoji: '⛩️', tmdbType: 'tv', cmdSugerir: 'sugeriranime', cmdAssistido: 'assistidoanime', cmdAvaliar: 'avaliaranime' };
module.exports = { name: 'votaranime', description: 'Cria uma votacao com os animes pendentes', usage: '!votaranime', async execute(message, args) { return executeVotar(message, args, CONFIG); } };

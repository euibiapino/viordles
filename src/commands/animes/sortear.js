const { executeSortear } = require('../../utils/mediaHandler');
const CONFIG = { type: 'anime', label: 'Anime', labelPlural: 'Animes', emoji: '⛩️', tmdbType: 'tv', cmdSugerir: 'sugeriranime', cmdAssistido: 'assistidoanime', cmdAvaliar: 'avaliaranime' };
module.exports = { name: 'sortearanime', description: 'Sorteia um anime aleatorio da lista', usage: '!sortearanime', async execute(message, args) { return executeSortear(message, args, CONFIG); } };

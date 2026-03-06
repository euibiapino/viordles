const { executeSortear } = require('../../utils/mediaHandler');
const CONFIG = { type: 'filme', label: 'Filme', labelPlural: 'Filmes', emoji: '🎬', tmdbType: 'movie', cmdSugerir: 'sugerir', cmdAssistido: 'assistido', cmdAvaliar: 'avaliar' };
module.exports = { name: 'sortearfilme', description: 'Sorteia um filme aleatorio da lista', usage: '!sortearfilme', async execute(message, args) { return executeSortear(message, args, CONFIG); } };

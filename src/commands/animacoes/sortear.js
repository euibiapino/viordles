const { executeSortear } = require('../../utils/mediaHandler');
const CONFIG = { type: 'animacao', label: 'Animacao', labelPlural: 'Animacoes', emoji: '🎠', tmdbType: 'movie', cmdSugerir: 'sugeriranim', cmdAssistido: 'assistidoanim', cmdAvaliar: 'avaliaranim' };
module.exports = { name: 'sortearanim', description: 'Sorteia uma animacao aleatoria da lista', usage: '!sortearanim', async execute(message, args) { return executeSortear(message, args, CONFIG); } };

const { executeSugerir } = require('../../utils/mediaHandler');
const CONFIG = { type: 'animacao', label: 'Animacao', labelPlural: 'Animacoes', emoji: '🎠', tmdbType: 'movie', cmdSugerir: 'sugeriranim', cmdAssistido: 'assistidoanim', cmdAvaliar: 'avaliaranim' };
module.exports = { name: 'sugeriranim', description: 'Sugere uma animacao para a lista', usage: '!sugeriranim <nome>', async execute(message, args) { return executeSugerir(message, args, CONFIG); } };

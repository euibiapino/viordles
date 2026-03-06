const { executeAvaliar } = require('../../utils/mediaHandler');
const CONFIG = { type: 'animacao', label: 'Animacao', labelPlural: 'Animacoes', emoji: '🎠', tmdbType: 'movie', cmdSugerir: 'sugeriranim', cmdAssistido: 'assistidoanim', cmdAvaliar: 'avaliaranim' };
module.exports = { name: 'avaliaranim', description: 'Avalia uma animacao (0-10)', usage: '!avaliaranim <nome> <nota>', async execute(message, args) { return executeAvaliar(message, args, CONFIG); } };

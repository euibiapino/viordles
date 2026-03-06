const { executeAssistido } = require('../../utils/mediaHandler');
const CONFIG = { type: 'animacao', label: 'Animacao', labelPlural: 'Animacoes', emoji: '🎠', tmdbType: 'movie', cmdSugerir: 'sugeriranim', cmdAssistido: 'assistidoanim', cmdAvaliar: 'avaliaranim' };
module.exports = { name: 'assistidoanim', description: 'Marca uma animacao como assistida', usage: '!assistidoanim <nome>', async execute(message, args) { return executeAssistido(message, args, CONFIG); } };

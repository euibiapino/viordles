const { executeVotar } = require('../../utils/mediaHandler');
const CONFIG = { type: 'animacao', label: 'Animacao', labelPlural: 'Animacoes', emoji: '🎠', tmdbType: 'movie', cmdSugerir: 'sugeriranim', cmdAssistido: 'assistidoanim', cmdAvaliar: 'avaliaranim' };
module.exports = { name: 'votaranim', description: 'Cria uma votacao com as animacoes pendentes', usage: '!votaranim', async execute(message, args) { return executeVotar(message, args, CONFIG); } };

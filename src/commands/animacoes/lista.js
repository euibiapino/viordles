const { executeListar } = require('../../utils/mediaHandler');
const CONFIG = { type: 'animacao', label: 'Animacao', labelPlural: 'Animacoes', emoji: '🎠', tmdbType: 'movie', cmdSugerir: 'sugeriranim', cmdAssistido: 'assistidoanim', cmdAvaliar: 'avaliaranim' };
module.exports = { name: 'animacoes', description: 'Lista as animacoes pendentes', usage: '!animacoes [pagina]', async execute(message, args) { return executeListar(message, args, CONFIG); } };

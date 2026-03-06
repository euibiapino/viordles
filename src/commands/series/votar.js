const { executeVotar } = require('../../utils/mediaHandler');
const CONFIG = { type: 'serie', label: 'Serie', labelPlural: 'Series', emoji: '📺', tmdbType: 'tv', cmdSugerir: 'sugerirs', cmdAssistido: 'assistidos', cmdAvaliar: 'avaliars' };
module.exports = { name: 'votars', description: 'Cria uma votacao com as series pendentes', usage: '!votars', async execute(message, args) { return executeVotar(message, args, CONFIG); } };

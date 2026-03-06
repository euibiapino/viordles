const { executeAvaliar } = require('../../utils/mediaHandler');
const CONFIG = { type: 'serie', label: 'Serie', labelPlural: 'Series', emoji: '📺', tmdbType: 'tv', cmdSugerir: 'sugerirs', cmdAssistido: 'assistidos', cmdAvaliar: 'avaliars' };
module.exports = { name: 'avaliars', description: 'Avalia uma serie (0-10)', usage: '!avaliars <nome> <nota>', async execute(message, args) { return executeAvaliar(message, args, CONFIG); } };

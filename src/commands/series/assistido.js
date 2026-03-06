const { executeAssistido } = require('../../utils/mediaHandler');
const CONFIG = { type: 'serie', label: 'Serie', labelPlural: 'Series', emoji: '📺', tmdbType: 'tv', cmdSugerir: 'sugerirs', cmdAssistido: 'assistidos', cmdAvaliar: 'avaliars' };
module.exports = { name: 'assistidos', description: 'Marca uma serie como assistida', usage: '!assistidos <nome>', async execute(message, args) { return executeAssistido(message, args, CONFIG); } };

const { executeSugerir } = require('../../utils/mediaHandler');
const CONFIG = { type: 'serie', label: 'Serie', labelPlural: 'Series', emoji: '📺', tmdbType: 'tv', cmdSugerir: 'sugerirs', cmdAssistido: 'assistidos', cmdAvaliar: 'avaliars' };
module.exports = { name: 'sugerirs', description: 'Sugere uma serie para a lista', usage: '!sugerirs <nome>', async execute(message, args) { return executeSugerir(message, args, CONFIG); } };

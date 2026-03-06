const { executeListar } = require('../../utils/mediaHandler');
const CONFIG = { type: 'serie', label: 'Serie', labelPlural: 'Series', emoji: '📺', tmdbType: 'tv', cmdSugerir: 'sugerirs', cmdAssistido: 'assistidos', cmdAvaliar: 'avaliars' };
module.exports = { name: 'series', description: 'Lista as series pendentes', usage: '!series [pagina]', async execute(message, args) { return executeListar(message, args, CONFIG); } };

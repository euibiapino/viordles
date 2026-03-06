const { executeSortear } = require('../../utils/mediaHandler');
const CONFIG = { type: 'serie', label: 'Serie', labelPlural: 'Series', emoji: '📺', tmdbType: 'tv', cmdSugerir: 'sugerirs', cmdAssistido: 'assistidos', cmdAvaliar: 'avaliars' };
module.exports = { name: 'sortears', description: 'Sorteia uma serie aleatoria da lista', usage: '!sortears', async execute(message, args) { return executeSortear(message, args, CONFIG); } };

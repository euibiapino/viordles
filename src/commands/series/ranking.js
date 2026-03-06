const { executeRanking } = require('../../utils/mediaHandler');
const CONFIG = { type: 'serie', label: 'Serie', labelPlural: 'Series', emoji: '📺', tmdbType: 'tv', cmdSugerir: 'sugerirs', cmdAssistido: 'assistidos', cmdAvaliar: 'avaliars' };
module.exports = { name: 'rankings', description: 'Ranking das series mais bem avaliadas', usage: '!rankings', async execute(message, args) { return executeRanking(message, args, CONFIG); } };

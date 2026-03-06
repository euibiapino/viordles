const { executeAssistido } = require('../../utils/mediaHandler');
const CONFIG = { type: 'filme', label: 'Filme', labelPlural: 'Filmes', emoji: '🎬', tmdbType: 'movie', cmdSugerir: 'sugerir', cmdAssistido: 'assistido', cmdAvaliar: 'avaliar' };
module.exports = { name: 'assistido', description: 'Marca um filme como assistido', usage: '!assistido <nome>', async execute(message, args) { return executeAssistido(message, args, CONFIG); } };

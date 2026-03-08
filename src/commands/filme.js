const { SlashCommandBuilder } = require('discord.js');
const { executeSugerir, executeListar, executeVotar, executeSortear, executeAssistido, executeAvaliar, executeRanking } = require('../utils/mediaHandler');

const CONFIG = { type: 'filme', label: 'Filme', labelPlural: 'Filmes', emoji: '🎬', tmdbType: 'movie' };

module.exports = {
  data: new SlashCommandBuilder()
    .setName('filme')
    .setDescription('Comandos de filmes')
    .addSubcommand(sub => sub
      .setName('sugerir')
      .setDescription('Sugere um filme para a lista')
      .addStringOption(opt => opt.setName('titulo').setDescription('Nome do filme').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('listar')
      .setDescription('Lista os filmes pendentes')
      .addIntegerOption(opt => opt.setName('pagina').setDescription('Numero da pagina').setMinValue(1)))
    .addSubcommand(sub => sub
      .setName('votar')
      .setDescription('Cria uma votacao com filmes pendentes'))
    .addSubcommand(sub => sub
      .setName('sortear')
      .setDescription('Sorteia um filme aleatorio da lista'))
    .addSubcommand(sub => sub
      .setName('assistido')
      .setDescription('Marca um filme como assistido')
      .addStringOption(opt => opt.setName('titulo').setDescription('Nome do filme').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('avaliar')
      .setDescription('Avalia um filme (0-10)')
      .addStringOption(opt => opt.setName('titulo').setDescription('Nome do filme').setRequired(true))
      .addNumberOption(opt => opt.setName('nota').setDescription('Nota de 0 a 10').setRequired(true).setMinValue(0).setMaxValue(10)))
    .addSubcommand(sub => sub
      .setName('ranking')
      .setDescription('Ranking dos filmes mais bem avaliados')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'sugerir') return executeSugerir(interaction, interaction.options.getString('titulo'), CONFIG);
    if (sub === 'listar')  return executeListar(interaction, interaction.options.getInteger('pagina'), CONFIG);
    if (sub === 'votar')   return executeVotar(interaction, CONFIG);
    if (sub === 'sortear') return executeSortear(interaction, CONFIG);
    if (sub === 'assistido') return executeAssistido(interaction, interaction.options.getString('titulo'), CONFIG);
    if (sub === 'avaliar') return executeAvaliar(interaction, interaction.options.getString('titulo'), interaction.options.getNumber('nota'), CONFIG);
    if (sub === 'ranking') return executeRanking(interaction, CONFIG);
  },
};

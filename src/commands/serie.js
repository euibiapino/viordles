const { SlashCommandBuilder } = require('discord.js');
const { executeSugerir, executeListar, executeVotar, executeSortear, executeAssistido, executeAvaliar, executeRanking } = require('../utils/mediaHandler');

const CONFIG = { type: 'serie', label: 'Serie', labelPlural: 'Series', emoji: '📺', tmdbType: 'tv' };

module.exports = {
  data: new SlashCommandBuilder()
    .setName('serie')
    .setDescription('Comandos de series')
    .addSubcommand(sub => sub
      .setName('sugerir')
      .setDescription('Sugere uma serie para a lista')
      .addStringOption(opt => opt.setName('titulo').setDescription('Nome da serie').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('listar')
      .setDescription('Lista as series pendentes')
      .addIntegerOption(opt => opt.setName('pagina').setDescription('Numero da pagina').setMinValue(1)))
    .addSubcommand(sub => sub
      .setName('votar')
      .setDescription('Cria uma votacao com series pendentes'))
    .addSubcommand(sub => sub
      .setName('sortear')
      .setDescription('Sorteia uma serie aleatoria da lista'))
    .addSubcommand(sub => sub
      .setName('assistido')
      .setDescription('Marca uma serie como assistida')
      .addStringOption(opt => opt.setName('titulo').setDescription('Nome da serie').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('avaliar')
      .setDescription('Avalia uma serie (0-10)')
      .addStringOption(opt => opt.setName('titulo').setDescription('Nome da serie').setRequired(true))
      .addNumberOption(opt => opt.setName('nota').setDescription('Nota de 0 a 10').setRequired(true).setMinValue(0).setMaxValue(10)))
    .addSubcommand(sub => sub
      .setName('ranking')
      .setDescription('Ranking das series mais bem avaliadas')),

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

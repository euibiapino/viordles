const { SlashCommandBuilder } = require('discord.js');
const {
  executeSugerir,
  executeListar,
  executeVotar,
  executeSortear,
  executeAssistido,
  executeAvaliar,
  executeRanking,
} = require('./mediaHandler');

function buildMediaCommand(cfg) {
  const { name, label, labelPlural, emoji, tmdbType, gender = 'm' } = cfg;
  const um = gender === 'f' ? 'uma' : 'um';
  const o = gender === 'f' ? 'a' : 'o';
  const lower = label.toLowerCase();
  const lowerPlural = labelPlural.toLowerCase();
  const config = { type: name, label, labelPlural, emoji, tmdbType };

  const data = new SlashCommandBuilder()
    .setName(name)
    .setDescription(`Comandos de ${lowerPlural}`)
    .addSubcommand((sub) =>
      sub
        .setName('sugerir')
        .setDescription(`Sugere ${um} ${lower} para a lista`)
        .addStringOption((opt) =>
          opt.setName('titulo').setDescription(`Nome d${o} ${lower}`).setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('listar')
        .setDescription(`Lista ${o}s ${lowerPlural} pendentes`)
        .addIntegerOption((opt) =>
          opt.setName('pagina').setDescription('Numero da pagina').setMinValue(1),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName('votar').setDescription(`Cria uma votacao com ${lowerPlural} pendentes`),
    )
    .addSubcommand((sub) =>
      sub.setName('sortear').setDescription(`Sorteia ${um} ${lower} aleatori${o} da lista`),
    )
    .addSubcommand((sub) =>
      sub
        .setName('assistido')
        .setDescription(`Marca ${um} ${lower} como assistid${o}`)
        .addStringOption((opt) =>
          opt.setName('titulo').setDescription(`Nome d${o} ${lower}`).setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('avaliar')
        .setDescription(`Avalia ${um} ${lower} (0-10)`)
        .addStringOption((opt) =>
          opt.setName('titulo').setDescription(`Nome d${o} ${lower}`).setRequired(true),
        )
        .addNumberOption((opt) =>
          opt
            .setName('nota')
            .setDescription('Nota de 0 a 10')
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(10),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName('ranking').setDescription(`Ranking d${o}s ${lowerPlural} mais bem avaliad${o}s`),
    );

  async function execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'sugerir')
      return executeSugerir(interaction, interaction.options.getString('titulo'), config);
    if (sub === 'listar')
      return executeListar(interaction, interaction.options.getInteger('pagina'), config);
    if (sub === 'votar') return executeVotar(interaction, config);
    if (sub === 'sortear') return executeSortear(interaction, config);
    if (sub === 'assistido')
      return executeAssistido(interaction, interaction.options.getString('titulo'), config);
    if (sub === 'avaliar')
      return executeAvaliar(
        interaction,
        interaction.options.getString('titulo'),
        interaction.options.getNumber('nota'),
        config,
      );
    if (sub === 'ranking') return executeRanking(interaction, config);
  }

  return { data, execute };
}

module.exports = buildMediaCommand;

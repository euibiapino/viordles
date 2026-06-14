const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const NUMBER_EMOJIS = ['1\u20E3', '2\u20E3', '3\u20E3', '4\u20E3', '5\u20E3'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('enquete')
    .setDescription('Cria uma enquete com opções personalizadas')
    .addStringOption((opt) =>
      opt.setName('pergunta').setDescription('Pergunta da enquete').setRequired(true),
    )
    .addStringOption((opt) => opt.setName('opcao1').setDescription('Opção 1').setRequired(true))
    .addStringOption((opt) => opt.setName('opcao2').setDescription('Opção 2').setRequired(true))
    .addStringOption((opt) => opt.setName('opcao3').setDescription('Opção 3'))
    .addStringOption((opt) => opt.setName('opcao4').setDescription('Opção 4'))
    .addStringOption((opt) => opt.setName('opcao5').setDescription('Opção 5'))
    .addStringOption((opt) =>
      opt
        .setName('ping')
        .setDescription('Mencionar alguém?')
        .addChoices({ name: '@here', value: '@here' }, { name: '@everyone', value: '@everyone' }),
    )
    .addRoleOption((opt) => opt.setName('role').setDescription('Role específica para mencionar')),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });

    const pergunta = interaction.options.getString('pergunta');
    const pingArg = interaction.options.getString('ping');
    const roleArg = interaction.options.getRole('role');

    const opcoes = ['opcao1', 'opcao2', 'opcao3', 'opcao4', 'opcao5']
      .map((k) => interaction.options.getString(k))
      .filter(Boolean);

    const pingContent = roleArg ? roleArg.toString() : (pingArg ?? '@here');

    const descricao = opcoes.map((op, i) => `${NUMBER_EMOJIS[i]}  ${op}`).join('\n');

    const embed = new EmbedBuilder()
      .setTitle(`📊  ${pergunta}`)
      .setColor(0x5865f2)
      .setDescription(descricao)
      .setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL() })
      .setFooter({ text: 'Reaja com o número da sua escolha' })
      .setTimestamp();

    const poll = await interaction.channel.send({ content: pingContent, embeds: [embed] });
    for (let i = 0; i < opcoes.length; i++) await poll.react(NUMBER_EMOJIS[i]);

    await interaction.deleteReply();
  },
};

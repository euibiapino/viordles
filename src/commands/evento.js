const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { searchMedia } = require('../utils/tmdb');
const { searchGame } = require('../utils/rawg');

const TIPOS = {
  stream: { emoji: '📡', label: 'Stream / Evento ao Vivo', color: 0xed4245 },
  filme: { emoji: '🎬', label: 'Watch Party — Filme', color: 0x5865f2 },
  serie: { emoji: '📺', label: 'Watch Party — Serie', color: 0x9b59b6 },
  jogo: { emoji: '🎮', label: 'Game Time', color: 0x57f287 },
  torneio: { emoji: '🏆', label: 'Torneio', color: 0xfee75c },
  sala: { emoji: '🚪', label: 'Sala Personalizada', color: 0x1abc9c },
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('evento')
    .setDescription('Cria um aviso de evento (apenas admins)')
    .addStringOption((opt) =>
      opt
        .setName('tipo')
        .setDescription('Tipo do evento')
        .setRequired(true)
        .addChoices(
          { name: 'Stream', value: 'stream' },
          { name: 'Filme', value: 'filme' },
          { name: 'Serie', value: 'serie' },
          { name: 'Jogo', value: 'jogo' },
          { name: 'Torneio', value: 'torneio' },
          { name: 'Sala', value: 'sala' },
        ),
    )
    .addStringOption((opt) =>
      opt.setName('titulo').setDescription('Titulo do evento').setRequired(true),
    )
    .addStringOption((opt) =>
      opt.setName('descricao').setDescription('Descricao do evento').setRequired(true),
    )
    .addStringOption((opt) => opt.setName('data').setDescription('Data/horario do evento'))
    .addStringOption((opt) =>
      opt
        .setName('ping')
        .setDescription('Mencionar alguém?')
        .addChoices({ name: '@here', value: '@here' }, { name: '@everyone', value: '@everyone' }),
    )
    .addRoleOption((opt) => opt.setName('role').setDescription('Role especifica para mencionar'))
    .addStringOption((opt) =>
      opt
        .setName('imagem')
        .setDescription('URL da imagem (opcional; buscada automaticamente para filme/serie/jogo)'),
    ),

  async execute(interaction) {
    if (!interaction.member.permissions.has('Administrator')) {
      const embed = new EmbedBuilder()
        .setColor(0xed4245)
        .setDescription('Apenas administradores podem criar eventos.');
      return interaction.reply({ embeds: [embed], flags: 64 });
    }

    await interaction.deferReply({ flags: 64 });

    const tipo = interaction.options.getString('tipo');
    const titulo = interaction.options.getString('titulo');
    const descricao = interaction.options.getString('descricao');
    const data = interaction.options.getString('data');
    const pingArg = interaction.options.getString('ping');
    const roleArg = interaction.options.getRole('role');
    const imagemArg = interaction.options.getString('imagem');

    const cfg = TIPOS[tipo];

    // Busca imagem automaticamente para filme, serie e jogo
    let imageUrl = imagemArg || null;
    if (!imageUrl) {
      if (tipo === 'filme') {
        const tmdb = await searchMedia(titulo, 'movie');
        imageUrl = tmdb?.poster || null;
      } else if (tipo === 'serie') {
        const tmdb = await searchMedia(titulo, 'tv');
        imageUrl = tmdb?.poster || null;
      } else if (tipo === 'jogo') {
        imageUrl = await searchGame(titulo);
      }
    }

    // Resolve ping
    const pingContent = roleArg ? roleArg.toString() : (pingArg ?? '@here');

    const tituloFormatado = titulo.replace(/\b\w/g, (c) => c.toUpperCase());

    const fields = [
      { name: '\u200b', value: '\u200b', inline: false },
      { name: '📌 Tipo', value: cfg.label, inline: true },
    ];
    if (data) fields.push({ name: '🗓️ Quando', value: data, inline: true });

    const embed = new EmbedBuilder()
      .setTitle(`${cfg.emoji} ${tituloFormatado}`)
      .setColor(cfg.color)
      .setDescription(`\n${descricao}\n`)
      .addFields(fields)
      .setAuthor({
        name: `Aviso por ${interaction.user.username}`,
        iconURL: interaction.user.displayAvatarURL(),
      })
      .setTimestamp();

    if (imageUrl) embed.setImage(imageUrl);

    await interaction.channel.send({ content: pingContent, embeds: [embed] });
    await interaction.deleteReply();
  },
};

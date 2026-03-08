const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { searchMedia } = require('../utils/tmdb');
const { searchGame } = require('../utils/rawg');

const TIPOS = {
  stream:   { emoji: '📡', label: 'Stream / Evento ao Vivo', color: 0xED4245 },
  filme:    { emoji: '🎬', label: 'Watch Party — Filme',     color: 0x5865F2 },
  serie:    { emoji: '📺', label: 'Watch Party — Serie',     color: 0x9B59B6 },
  jogo:     { emoji: '🎮', label: 'Game Time',               color: 0x57F287 },
  torneio:  { emoji: '🏆', label: 'Torneio',                 color: 0xFEE75C },
  sala:     { emoji: '🚪', label: 'Sala Personalizada',      color: 0x1ABC9C },
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('evento')
    .setDescription('Cria um aviso de evento (apenas admins)')
    .addStringOption(opt => opt
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
      ))
    .addStringOption(opt => opt.setName('titulo').setDescription('Titulo do evento').setRequired(true))
    .addStringOption(opt => opt.setName('descricao').setDescription('Descricao do evento').setRequired(true))
    .addStringOption(opt => opt.setName('data').setDescription('Data/horario do evento'))
    .addStringOption(opt => opt.setName('ping').setDescription('Ping: @here, @everyone ou nome da role'))
    .addStringOption(opt => opt.setName('imagem').setDescription('URL da imagem (opcional; buscada automaticamente para filme/serie/jogo)')),

  async execute(interaction) {
    if (!interaction.member.permissions.has('Administrator')) {
      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setDescription('Apenas administradores podem criar eventos.');
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const tipo      = interaction.options.getString('tipo');
    const titulo    = interaction.options.getString('titulo');
    const descricao = interaction.options.getString('descricao');
    const data      = interaction.options.getString('data');
    const pingArg   = interaction.options.getString('ping');
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
    let pingContent = null;
    if (pingArg) {
      if (pingArg.includes('@everyone')) {
        pingContent = '@everyone';
      } else if (pingArg.includes('@here')) {
        pingContent = '@here';
      } else {
        // Tenta encontrar role pelo nome
        const role = interaction.guild.roles.cache.find(r => r.name.toLowerCase() === pingArg.toLowerCase());
        pingContent = role ? role.toString() : null;
      }
    }

    const tituloFormatado = titulo.replace(/\b\w/g, c => c.toUpperCase());

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
      .setAuthor({ name: `Aviso por ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();

    if (imageUrl) embed.setImage(imageUrl);

    await interaction.channel.send({ content: pingContent, embeds: [embed] });
    await interaction.editReply({ content: 'Evento criado!' });
  },
};

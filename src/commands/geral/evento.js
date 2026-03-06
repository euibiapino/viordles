const { EmbedBuilder } = require('discord.js');
const { searchMedia } = require('../../utils/tmdb');
const { searchGame } = require('../../utils/rawg');

const TIPOS = {
  stream:   { emoji: '📡', label: 'Stream / Evento ao Vivo', color: 0xED4245 },
  filme:    { emoji: '🎬', label: 'Watch Party — Filme',     color: 0x5865F2 },
  serie:    { emoji: '📺', label: 'Watch Party — Serie',     color: 0x9B59B6 },
  jogo:     { emoji: '🎮', label: 'Game Time',               color: 0x57F287 },
  torneio:  { emoji: '🏆', label: 'Torneio',                 color: 0xFEE75C },
  sala:     { emoji: '🚪', label: 'Sala Personalizada',      color: 0x1ABC9C },
};

module.exports = {
  name: 'evento',
  description: 'Cria um aviso de evento (apenas admins)',
  usage: '!evento <tipo> | <titulo> | <descricao> | [data] | [@ping] | [imagem_url]',
  async execute(message, args) {
    if (!message.member.permissions.has('Administrator')) {
      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setDescription('Apenas administradores podem criar eventos.');
      return message.reply({ embeds: [embed] });
    }

    const full = message.content.slice('!evento'.length).trim();
    const parts = full.split('|').map(p => p.trim());

    const tipo = parts[0]?.toLowerCase();
    const titulo = parts[1];
    const descricao = parts[2];
    const data = parts[3] || null;
    const part4 = parts[4] || null;
    const part5 = parts[5] || null;
    const pingArg = part4?.startsWith('http') ? null : part4;
    const imagemUrl = part4?.startsWith('http') ? part4 : part5;

    if (!TIPOS[tipo] || !titulo || !descricao) {
      const tiposLista = Object.keys(TIPOS).join(', ');
      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('Uso incorreto')
        .setDescription(
          `\`!evento <tipo> | <titulo> | <descricao> | [data] | [@ping] | [imagem_url]\`\n\n` +
          `**Tipos disponíveis:** ${tiposLista}`
        );
      return message.reply({ embeds: [embed] });
    }

    const cfg = TIPOS[tipo];

    // Busca imagem automaticamente para filme, serie e jogo
    let imageUrl = imagemUrl;
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
    const roleMention = message.mentions.roles.first();
    let pingContent = null;
    if (roleMention) {
      pingContent = roleMention.toString();
    } else if (pingArg && pingArg.includes('@here')) {
      pingContent = '@here';
    } else if (pingArg && pingArg.includes('@everyone')) {
      pingContent = '@everyone';
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
      .setAuthor({ name: `Aviso por ${message.author.username}`, iconURL: message.author.displayAvatarURL() })
      .setTimestamp();

    if (imageUrl) embed.setImage(imageUrl);

    await message.delete().catch(() => {});
    await message.channel.send({ content: pingContent, embeds: [embed] });
  },
};

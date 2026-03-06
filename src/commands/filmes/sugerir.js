const { EmbedBuilder } = require('discord.js');
const pool = require('../../db/pool');
const { searchMovie } = require('../../utils/tmdb');

module.exports = {
  name: 'sugerir',
  description: 'Sugere um filme para a lista',
  usage: '!sugerir <nome do filme>',
  async execute(message, args) {
    const title = args.join(' ').trim();
    if (!title) {
      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setDescription('Uso: `!sugerir <nome do filme>`');
      return message.reply({ embeds: [embed] });
    }

    const existing = await pool.query(
      'SELECT * FROM movies WHERE LOWER(title) = LOWER($1) AND watched = FALSE',
      [title]
    );

    if (existing.rows.length > 0) {
      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setDescription(`**${title}** ja esta na lista!`);
      return message.reply({ embeds: [embed] });
    }

    const tmdb = await searchMovie(title);
    const displayTitle = tmdb?.title || title;
    const posterUrl = tmdb?.poster || null;

    await pool.query(
      'INSERT INTO movies (title, suggested_by, poster_url) VALUES ($1, $2, $3)',
      [displayTitle, message.author.username, posterUrl]
    );

    const embed = new EmbedBuilder()
      .setTitle('🎬 Filme Adicionado!')
      .setColor(0x57F287)
      .addFields(
        { name: 'Filme', value: displayTitle, inline: true },
        { name: 'Sugerido por', value: message.author.username, inline: true },
      )
      .setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL() })
      .setTimestamp();

    if (posterUrl) embed.setThumbnail(posterUrl);
    if (tmdb?.overview) embed.setDescription(`*${tmdb.overview.substring(0, 150)}...*`);
    if (tmdb?.year) embed.addFields({ name: 'Ano', value: tmdb.year, inline: true });

    message.reply({ embeds: [embed] });
  },
};

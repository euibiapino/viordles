const { EmbedBuilder } = require('discord.js');
const pool = require('../../db/pool');

module.exports = {
  name: 'avaliar',
  description: 'Avalia um filme assistido (nota de 0 a 10)',
  usage: '!avaliar <nome do filme> <nota>',
  async execute(message, args) {
    if (args.length < 2) {
      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setDescription('Uso: `!avaliar <nome do filme> <nota>`');
      return message.reply({ embeds: [embed] });
    }

    const rating = parseFloat(args[args.length - 1]);
    const title = args.slice(0, -1).join(' ').trim();

    if (isNaN(rating) || rating < 0 || rating > 10) {
      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setDescription('A nota deve ser um numero entre 0 e 10.');
      return message.reply({ embeds: [embed] });
    }

    const movie = await pool.query(
      'SELECT id, title, poster_url FROM movies WHERE LOWER(title) = LOWER($1) AND watched = TRUE',
      [title]
    );

    if (movie.rows.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setDescription('Filme nao encontrado nos assistidos. Marque como assistido primeiro com `!assistido`.');
      return message.reply({ embeds: [embed] });
    }

    await pool.query(
      `INSERT INTO movie_ratings (movie_id, user_id, username, rating)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (movie_id, user_id) DO UPDATE SET rating = $4`,
      [movie.rows[0].id, message.author.id, message.author.username, rating]
    );

    const filled = Math.round(rating / 2);
    const stars = '★'.repeat(filled) + '☆'.repeat(5 - filled);
    const embed = new EmbedBuilder()
      .setTitle('⭐ Avaliacao Registrada!')
      .setColor(0xFEE75C)
      .addFields(
        { name: '🎬 Filme', value: movie.rows[0].title, inline: true },
        { name: '👤 Por', value: message.author.username, inline: true },
        { name: '🎯 Nota', value: `**${rating}/10** ${stars}`, inline: false }
      )
      .setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL() })
      .setTimestamp();

    if (movie.rows[0].poster_url) embed.setThumbnail(movie.rows[0].poster_url);

    message.reply({ embeds: [embed] });
  },
};

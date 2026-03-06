const { EmbedBuilder } = require('discord.js');
const pool = require('../../db/pool');

module.exports = {
  name: 'rankingfilmes',
  description: 'Mostra o ranking dos filmes mais bem avaliados',
  usage: '!rankingfilmes',
  async execute(message) {
    const result = await pool.query(`
      SELECT m.title, m.poster_url, ROUND(AVG(r.rating), 1) as media, COUNT(r.id) as votos
      FROM movies m
      JOIN movie_ratings r ON r.movie_id = m.id
      WHERE m.watched = TRUE
      GROUP BY m.id, m.title, m.poster_url
      ORDER BY media DESC, votos DESC
      LIMIT 10
    `);

    if (result.rows.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setDescription('Nenhum filme avaliado ainda!');
      return message.reply({ embeds: [embed] });
    }

    const medals = ['🥇', '🥈', '🥉'];
    const list = result.rows
      .map((m, i) => `${medals[i] || `**${i + 1}.**`} ${m.title} — ${m.media}/10 *(${m.votos} voto${m.votos > 1 ? 's' : ''})*`)
      .join('\n');

    const top = result.rows[0];
    const embed = new EmbedBuilder()
      .setTitle('🏆 Ranking de Filmes')
      .setColor(0xFEE75C)
      .setDescription(list)
      .setTimestamp();

    if (top.poster_url) embed.setThumbnail(top.poster_url);

    message.reply({ embeds: [embed] });
  },
};

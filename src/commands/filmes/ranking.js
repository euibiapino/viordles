const pool = require('../../db/pool');

module.exports = {
  name: 'rankingfilmes',
  description: 'Mostra o ranking dos filmes mais bem avaliados',
  usage: '!rankingfilmes',
  async execute(message) {
    const result = await pool.query(`
      SELECT m.title, ROUND(AVG(r.rating), 1) as media, COUNT(r.id) as votos
      FROM movies m
      JOIN movie_ratings r ON r.movie_id = m.id
      WHERE m.watched = TRUE
      GROUP BY m.id, m.title
      ORDER BY media DESC, votos DESC
      LIMIT 10
    `);

    if (result.rows.length === 0) {
      return message.reply('Nenhum filme avaliado ainda!');
    }

    const list = result.rows
      .map((m, i) => `**${i + 1}.** ${m.title} - ${m.media}/10 _(${m.votos} voto${m.votos > 1 ? 's' : ''})_`)
      .join('\n');

    message.reply(`**Ranking de Filmes:**\n${list}`);
  },
};

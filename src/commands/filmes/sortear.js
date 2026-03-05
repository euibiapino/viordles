const pool = require('../../db/pool');

module.exports = {
  name: 'sortearfilme',
  description: 'Sorteia um filme aleatorio da lista',
  usage: '!sortearfilme',
  async execute(message) {
    const result = await pool.query(
      'SELECT title, suggested_by FROM movies WHERE watched = FALSE ORDER BY RANDOM() LIMIT 1'
    );

    if (result.rows.length === 0) {
      return message.reply('Nenhum filme na lista para sortear!');
    }

    const movie = result.rows[0];
    message.reply(`O filme sorteado foi: **${movie.title}** _(sugerido por ${movie.suggested_by})_`);
  },
};

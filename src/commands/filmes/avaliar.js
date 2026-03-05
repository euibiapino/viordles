const pool = require('../../db/pool');

module.exports = {
  name: 'avaliar',
  description: 'Avalia um filme assistido (nota de 0 a 10)',
  usage: '!avaliar <nome do filme> <nota>',
  async execute(message, args) {
    if (args.length < 2) {
      return message.reply('Uso: `!avaliar <nome do filme> <nota>`');
    }

    const rating = parseFloat(args[args.length - 1]);
    const title = args.slice(0, -1).join(' ').trim();

    if (isNaN(rating) || rating < 0 || rating > 10) {
      return message.reply('A nota deve ser um numero entre 0 e 10.');
    }

    const movie = await pool.query(
      'SELECT id, title FROM movies WHERE LOWER(title) = LOWER($1) AND watched = TRUE',
      [title]
    );

    if (movie.rows.length === 0) {
      return message.reply('Filme nao encontrado nos assistidos. Marque como assistido primeiro com `!assistido`.');
    }

    await pool.query(
      `INSERT INTO movie_ratings (movie_id, user_id, username, rating)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (movie_id, user_id) DO UPDATE SET rating = $4`,
      [movie.rows[0].id, message.author.id, message.author.username, rating]
    );

    message.reply(`Voce avaliou **${movie.rows[0].title}** com nota **${rating}**!`);
  },
};

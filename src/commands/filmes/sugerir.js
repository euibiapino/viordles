const pool = require('../../db/pool');

module.exports = {
  name: 'sugerir',
  description: 'Sugere um filme para a lista',
  usage: '!sugerir <nome do filme>',
  async execute(message, args) {
    const title = args.join(' ').trim();
    if (!title) {
      return message.reply('Uso: `!sugerir <nome do filme>`');
    }

    const existing = await pool.query(
      'SELECT * FROM movies WHERE LOWER(title) = LOWER($1) AND watched = FALSE',
      [title]
    );
    if (existing.rows.length > 0) {
      return message.reply('Esse filme ja esta na lista!');
    }

    await pool.query(
      'INSERT INTO movies (title, suggested_by) VALUES ($1, $2)',
      [title, message.author.username]
    );
    message.reply(`**${title}** adicionado a lista de filmes!`);
  },
};

const pool = require('../../db/pool');

module.exports = {
  name: 'assistido',
  description: 'Marca um filme como assistido',
  usage: '!assistido <nome do filme>',
  async execute(message, args) {
    const title = args.join(' ').trim();
    if (!title) {
      return message.reply('Uso: `!assistido <nome do filme>`');
    }

    const result = await pool.query(
      'UPDATE movies SET watched = TRUE, watched_at = NOW() WHERE LOWER(title) = LOWER($1) AND watched = FALSE RETURNING title',
      [title]
    );

    if (result.rows.length === 0) {
      return message.reply('Filme nao encontrado na lista de pendentes.');
    }

    message.reply(`**${result.rows[0].title}** marcado como assistido! Use \`!avaliar ${result.rows[0].title} <nota>\` para avaliar.`);
  },
};

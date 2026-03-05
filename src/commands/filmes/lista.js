const pool = require('../../db/pool');

module.exports = {
  name: 'filmes',
  description: 'Mostra a lista de filmes pendentes',
  usage: '!filmes',
  async execute(message) {
    const result = await pool.query(
      'SELECT id, title, suggested_by FROM movies WHERE watched = FALSE ORDER BY created_at'
    );

    if (result.rows.length === 0) {
      return message.reply('Nenhum filme na lista! Use `!sugerir` para adicionar.');
    }

    const list = result.rows
      .map((m, i) => `**${i + 1}.** ${m.title} _(sugerido por ${m.suggested_by})_`)
      .join('\n');

    message.reply(`**Filmes pendentes:**\n${list}`);
  },
};

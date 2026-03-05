const pool = require('../../db/pool');

module.exports = {
  name: 'sortearjogo',
  description: 'Sorteia um jogo da lista de jogos registrados',
  usage: '!sortearjogo',
  async execute(message) {
    const result = await pool.query('SELECT name FROM games ORDER BY RANDOM() LIMIT 1');

    if (result.rows.length === 0) {
      return message.reply('Nenhum jogo registrado ainda! Registre partidas com `!placar` para adicionar jogos.');
    }

    message.reply(`O jogo sorteado foi: **${result.rows[0].name}**!`);
  },
};

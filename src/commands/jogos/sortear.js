const { EmbedBuilder } = require('discord.js');
const pool = require('../../db/pool');

module.exports = {
  name: 'sortearjogo',
  description: 'Sorteia um jogo da lista de jogos registrados',
  usage: '!sortearjogo',
  async execute(message) {
    const result = await pool.query('SELECT name FROM games ORDER BY RANDOM() LIMIT 1');

    if (result.rows.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setDescription('Nenhum jogo registrado ainda! Registre partidas com `!placar` para adicionar jogos.');
      return message.reply({ embeds: [embed] });
    }

    const embed = new EmbedBuilder()
      .setTitle('Jogo Sorteado!')
      .setColor(0x57F287)
      .setDescription(`**${result.rows[0].name}**`);

    message.reply({ embeds: [embed] });
  },
};

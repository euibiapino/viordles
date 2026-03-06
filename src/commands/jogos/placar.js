const { EmbedBuilder } = require('discord.js');
const pool = require('../../db/pool');

module.exports = {
  name: 'placar',
  description: 'Registra resultado de uma partida',
  usage: '!placar <jogo> @vencedor @perdedor',
  async execute(message, args) {
    if (args.length < 2 || message.mentions.users.size < 2) {
      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setDescription('Uso: `!placar <jogo> @vencedor @perdedor`');
      return message.reply({ embeds: [embed] });
    }

    const mentions = [...message.mentions.users.values()];
    const winner = mentions[0];
    const loser = mentions[1];
    const gameName = args.filter(a => !a.startsWith('<@')).join(' ').trim();

    if (!gameName) {
      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setDescription('Informe o nome do jogo! Uso: `!placar <jogo> @vencedor @perdedor`');
      return message.reply({ embeds: [embed] });
    }

    const game = await pool.query(
      'INSERT INTO games (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = $1 RETURNING id',
      [gameName.toLowerCase()]
    );

    await pool.query(
      'INSERT INTO game_scores (game_id, winner_id, winner_name, loser_id, loser_name) VALUES ($1, $2, $3, $4, $5)',
      [game.rows[0].id, winner.id, winner.username, loser.id, loser.username]
    );

    const embed = new EmbedBuilder()
      .setTitle('Partida Registrada!')
      .setColor(0x57F287)
      .addFields(
        { name: 'Jogo', value: gameName, inline: true },
        { name: 'Vencedor', value: winner.username, inline: true },
        { name: 'Perdedor', value: loser.username, inline: true }
      );

    message.reply({ embeds: [embed] });
  },
};

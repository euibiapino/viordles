const { EmbedBuilder } = require('discord.js');
const pool = require('../../db/pool');

const NUMBER_EMOJIS = ['1\u20E3', '2\u20E3', '3\u20E3', '4\u20E3', '5\u20E3', '6\u20E3', '7\u20E3', '8\u20E3', '9\u20E3', '\uD83D\uDD1F'];

module.exports = {
  name: 'votar',
  description: 'Cria uma votacao com os filmes pendentes',
  usage: '!votar',
  async execute(message) {
    const result = await pool.query(
      'SELECT id, title FROM movies WHERE watched = FALSE ORDER BY created_at LIMIT 10'
    );

    if (result.rows.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setDescription('Nenhum filme na lista para votar!');
      return message.reply({ embeds: [embed] });
    }

    const list = result.rows
      .map((m, i) => `${NUMBER_EMOJIS[i]} ${m.title}`)
      .join('\n');

    const embed = new EmbedBuilder()
      .setTitle('Vote no Proximo Filme!')
      .setColor(0xFEE75C)
      .setDescription(list)
      .setFooter({ text: 'Reaja com o numero do seu filme favorito' });

    const poll = await message.channel.send({ embeds: [embed] });

    for (let i = 0; i < result.rows.length; i++) {
      await poll.react(NUMBER_EMOJIS[i]);
    }
  },
};

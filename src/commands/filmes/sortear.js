const { EmbedBuilder } = require('discord.js');
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
      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setDescription('Nenhum filme na lista para sortear!');
      return message.reply({ embeds: [embed] });
    }

    const movie = result.rows[0];
    const embed = new EmbedBuilder()
      .setTitle('Filme Sorteado!')
      .setColor(0x57F287)
      .addFields(
        { name: 'Filme', value: movie.title, inline: true },
        { name: 'Sugerido por', value: movie.suggested_by, inline: true }
      );

    message.reply({ embeds: [embed] });
  },
};

const { EmbedBuilder } = require('discord.js');
const pool = require('../../db/pool');

module.exports = {
  name: 'assistido',
  description: 'Marca um filme como assistido',
  usage: '!assistido <nome do filme>',
  async execute(message, args) {
    const title = args.join(' ').trim();
    if (!title) {
      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setDescription('Uso: `!assistido <nome do filme>`');
      return message.reply({ embeds: [embed] });
    }

    const result = await pool.query(
      'UPDATE movies SET watched = TRUE, watched_at = NOW() WHERE LOWER(title) = LOWER($1) AND watched = FALSE RETURNING title',
      [title]
    );

    if (result.rows.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setDescription('Filme nao encontrado na lista de pendentes.');
      return message.reply({ embeds: [embed] });
    }

    const embed = new EmbedBuilder()
      .setTitle('Filme Assistido!')
      .setColor(0x57F287)
      .setDescription(`**${result.rows[0].title}** marcado como assistido!`)
      .setFooter({ text: `Use !avaliar ${result.rows[0].title} <nota> para avaliar` });

    message.reply({ embeds: [embed] });
  },
};

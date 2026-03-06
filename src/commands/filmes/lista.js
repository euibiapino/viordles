const { EmbedBuilder } = require('discord.js');
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
      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setDescription('Nenhum filme na lista! Use `!sugerir <filme>` para adicionar.');
      return message.reply({ embeds: [embed] });
    }

    const list = result.rows
      .map((m, i) => `**${i + 1}.** ${m.title} — *${m.suggested_by}*`)
      .join('\n');

    const embed = new EmbedBuilder()
      .setTitle('🎬 Filmes Pendentes')
      .setColor(0x5865F2)
      .setDescription(list)
      .setFooter({ text: `${result.rows.length} filme(s) na lista` })
      .setTimestamp();

    message.reply({ embeds: [embed] });
  },
};

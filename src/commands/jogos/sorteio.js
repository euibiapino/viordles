const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'sorteio',
  description: 'Sorteia um participante entre os mencionados',
  usage: '!sorteio @user1 @user2 ...',
  async execute(message) {
    const mentions = [...message.mentions.users.values()].filter(u => !u.bot);

    if (mentions.length < 2) {
      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setDescription('Mencione pelo menos 2 participantes! Uso: `!sorteio @user1 @user2 ...`');
      return message.reply({ embeds: [embed] });
    }

    const vencedor = mentions[Math.floor(Math.random() * mentions.length)];

    const embed = new EmbedBuilder()
      .setTitle('🎲 Sorteio!')
      .setColor(0xFEE75C)
      .setDescription(`O sorteado foi **${vencedor}**!`)
      .setThumbnail(vencedor.displayAvatarURL({ size: 256 }))
      .addFields({ name: '👥 Participantes', value: mentions.map(u => u.username).join(', ') })
      .setTimestamp();

    message.reply({ embeds: [embed] });
  },
};

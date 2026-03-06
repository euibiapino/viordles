const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'lfg',
  description: 'Chama a galera pra jogar',
  usage: '!lfg <jogo> [@role opcional]',
  async execute(message, args) {
    if (args.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setDescription('Uso: `!lfg <jogo> [@role opcional]`');
      return message.reply({ embeds: [embed] });
    }

    const roleMention = message.mentions.roles.first();
    const game = args.filter(a => !a.startsWith('<@&')).join(' ');
    const ping = roleMention ? roleMention.toString() : '@here';

    const embed = new EmbedBuilder()
      .setTitle('Looking for Group!')
      .setColor(0x57F287)
      .setDescription(`${message.author} quer jogar **${game}**! Quem ta dentro?`)
      .setFooter({ text: 'Reaja com ✅ para entrar' });

    message.channel.send({ content: ping, embeds: [embed] }).then(msg => msg.react('✅'));
  },
};

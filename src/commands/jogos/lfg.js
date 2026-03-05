module.exports = {
  name: 'lfg',
  description: 'Chama a galera pra jogar',
  usage: '!lfg <jogo> [@role opcional]',
  async execute(message, args) {
    if (args.length === 0) {
      return message.reply('Uso: `!lfg <jogo> [@role opcional]`');
    }

    const roleMention = message.mentions.roles.first();
    const game = args.filter(a => !a.startsWith('<@&')).join(' ');

    const ping = roleMention ? roleMention.toString() : '@here';
    message.channel.send(
      `${ping} **${message.author.username}** quer jogar **${game}**! Quem ta dentro? React com ✅`
    ).then(msg => msg.react('✅'));
  },
};

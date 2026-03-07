const { EmbedBuilder } = require('discord.js');
const { searchGame } = require('../../utils/rawg');

module.exports = {
  name: 'lfg',
  description: 'Chama pra jogar um jogo específico',
  usage: '!lfg <jogo> | [mensagem] | [@role]',
  async execute(message, args) {
    const full = message.content.slice('!lfg'.length).trim();
    if (!full) {
      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setDescription('Uso: `!lfg <jogo> | [mensagem] | [@role]`');
      return message.reply({ embeds: [embed] });
    }

    const parts = full.split('|').map(p => p.trim());
    const game = parts[0];
    const extra = parts[1] || null;
    const roleMention = message.mentions.roles.first();
    const ping = roleMention ? roleMention.toString() : '@here';

    const imageUrl = await searchGame(game);

    const descricao = extra
      ? `${message.author} quer jogar **${game}**!\n\n${extra}`
      : `${message.author} quer jogar **${game}**! Quem ta dentro?`;

    const embed = new EmbedBuilder()
      .setTitle('Looking for Group!')
      .setColor(0x57F287)
      .setDescription(descricao)
      .setFooter({ text: 'Reaja com ✅ para entrar' });

    if (imageUrl) embed.setImage(imageUrl);

    message.channel.send({ content: ping, embeds: [embed] }).then(msg => msg.react('✅'));
  },
};

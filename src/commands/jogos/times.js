const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'times',
  description: 'Divide quem esta na call em times',
  usage: '!times [quantidade de times]',
  async execute(message, args) {
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) {
      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setDescription('Voce precisa estar em um canal de voz!');
      return message.reply({ embeds: [embed] });
    }

    const members = [...voiceChannel.members.values()]
      .filter(m => !m.user.bot)
      .map(m => m.user.username);

    if (members.length < 2) {
      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setDescription('Precisa de pelo menos 2 pessoas na call!');
      return message.reply({ embeds: [embed] });
    }

    const numTeams = parseInt(args[0]) || 2;
    if (numTeams < 2 || numTeams > members.length) {
      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setDescription(`Numero de times deve ser entre 2 e ${members.length}.`);
      return message.reply({ embeds: [embed] });
    }

    const shuffled = members.sort(() => Math.random() - 0.5);
    const teams = Array.from({ length: numTeams }, () => []);
    shuffled.forEach((member, i) => teams[i % numTeams].push(member));

    const embed = new EmbedBuilder()
      .setTitle('Times Sorteados!')
      .setColor(0x5865F2)
      .addFields(
        teams.map((team, i) => ({
          name: `Time ${i + 1}`,
          value: team.join(', '),
          inline: true,
        }))
      );

    message.reply({ embeds: [embed] });
  },
};

module.exports = {
  name: 'times',
  description: 'Divide quem esta na call em times',
  usage: '!times [quantidade de times]',
  async execute(message, args) {
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) {
      return message.reply('Voce precisa estar em um canal de voz!');
    }

    const members = [...voiceChannel.members.values()]
      .filter(m => !m.user.bot)
      .map(m => m.user.username);

    if (members.length < 2) {
      return message.reply('Precisa de pelo menos 2 pessoas na call!');
    }

    const numTeams = parseInt(args[0]) || 2;
    if (numTeams < 2 || numTeams > members.length) {
      return message.reply(`Numero de times deve ser entre 2 e ${members.length}.`);
    }

    const shuffled = members.sort(() => Math.random() - 0.5);
    const teams = Array.from({ length: numTeams }, () => []);

    shuffled.forEach((member, i) => {
      teams[i % numTeams].push(member);
    });

    const result = teams
      .map((team, i) => `**Time ${i + 1}:** ${team.join(', ')}`)
      .join('\n');

    message.reply(`**Times sorteados:**\n${result}`);
  },
};

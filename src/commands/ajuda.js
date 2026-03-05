module.exports = {
  name: 'ajuda',
  description: 'Mostra todos os comandos disponiveis',
  usage: '!ajuda',
  async execute(message, args, commands) {
    const list = [...commands.values()]
      .map(cmd => `\`${cmd.usage}\` - ${cmd.description}`)
      .join('\n');

    message.reply(`**Comandos disponiveis:**\n\n${list}`);
  },
};

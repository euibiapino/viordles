const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'ajuda',
  description: 'Mostra todos os comandos disponiveis',
  usage: '!ajuda',
  async execute(message, args, commands) {
    const filmesNomes = ['filmes','sugerir','votar','sortearfilme','assistido','avaliar','rankingfilmes'];
    const jogosNomes = ['lfg','times','placar','rankingjogos','sortearjogo'];

    const filmes = [...commands.values()].filter(c => filmesNomes.includes(c.name));
    const jogos = [...commands.values()].filter(c => jogosNomes.includes(c.name));

    const embed = new EmbedBuilder()
      .setTitle('Comandos do Viordles')
      .setColor(0x5865F2)
      .addFields(
        {
          name: 'Filmes',
          value: filmes.map(c => `\`${c.usage}\` — ${c.description}`).join('\n') || 'Nenhum',
        },
        {
          name: 'Jogos',
          value: jogos.map(c => `\`${c.usage}\` — ${c.description}`).join('\n') || 'Nenhum',
        }
      )
      .setFooter({ text: 'Viordles Bot' });

    message.reply({ embeds: [embed] });
  },
};

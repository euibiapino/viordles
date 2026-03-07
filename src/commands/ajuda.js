const { EmbedBuilder } = require('discord.js');

const CATEGORIAS = {
  filmes:    { emoji: '🎬', label: 'Filmes',    cmds: ['sugerir','filmes','votar','sortearfilme','assistido','avaliar','rankingfilmes'] },
  series:    { emoji: '📺', label: 'Series',    cmds: ['sugerirs','series','votars','sortears','assistidos','avaliars','rankings'] },
  animes:    { emoji: '⛩️', label: 'Animes',    cmds: ['sugeriranime','animes','votaranime','sortearanime','assistidoanime','avaliaranime','rankinganime'] },
  animacoes: { emoji: '🎠', label: 'Animacoes', cmds: ['sugeriranim','animacoes','votaranim','sortearanim','assistidoanim','avaliaranim','rankinganim'] },
  jogos:     { emoji: '🎮', label: 'Jogos',     cmds: ['lfg','times','placar','rankingjogos','sortearjogo','sorteio'] },
  geral:     { emoji: '📣', label: 'Geral',     cmds: ['evento'] },
};

module.exports = {
  name: 'ajuda',
  description: 'Mostra os comandos disponiveis',
  usage: '!ajuda [categoria]',
  async execute(message, args, commands) {
    const cat = args[0]?.toLowerCase();
    const catInfo = CATEGORIAS[cat];

    if (catInfo) {
      const lista = catInfo.cmds
        .map(name => commands.get(name))
        .filter(Boolean)
        .map(c => `\`${c.usage}\`\n${c.description}`)
        .join('\n\n');

      const embed = new EmbedBuilder()
        .setTitle(`${catInfo.emoji} Comandos — ${catInfo.label}`)
        .setColor(0x5865F2)
        .setDescription(lista || 'Nenhum comando encontrado.')
        .setFooter({ text: '!ajuda para ver categorias' });

      return message.reply({ embeds: [embed] });
    }

    const cats = Object.entries(CATEGORIAS)
      .map(([key, c]) => `${c.emoji} **${c.label}** — \`!ajuda ${key}\``)
      .join('\n');

    const embed = new EmbedBuilder()
      .setTitle('Viordles — Categorias')
      .setColor(0x5865F2)
      .setDescription(cats)
      .setFooter({ text: 'Use !ajuda <categoria> para ver os comandos' });

    message.reply({ embeds: [embed] });
  },
};

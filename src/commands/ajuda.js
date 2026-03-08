const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const CATEGORIAS = {
  filme:    { emoji: '🎬', label: 'Filme',    cmds: [
    '`/filme sugerir <titulo>` — Sugere um filme para a lista',
    '`/filme listar [pagina]` — Lista os filmes pendentes',
    '`/filme votar` — Cria uma votacao com filmes pendentes',
    '`/filme sortear` — Sorteia um filme aleatorio',
    '`/filme assistido <titulo>` — Marca um filme como assistido',
    '`/filme avaliar <titulo> <nota>` — Avalia um filme (0-10)',
    '`/filme ranking` — Ranking dos filmes mais bem avaliados',
  ]},
  serie:    { emoji: '📺', label: 'Serie',    cmds: [
    '`/serie sugerir <titulo>` — Sugere uma serie para a lista',
    '`/serie listar [pagina]` — Lista as series pendentes',
    '`/serie votar` — Cria uma votacao com series pendentes',
    '`/serie sortear` — Sorteia uma serie aleatoria',
    '`/serie assistido <titulo>` — Marca uma serie como assistida',
    '`/serie avaliar <titulo> <nota>` — Avalia uma serie (0-10)',
    '`/serie ranking` — Ranking das series mais bem avaliadas',
  ]},
  anime:    { emoji: '⛩️', label: 'Anime',    cmds: [
    '`/anime sugerir <titulo>` — Sugere um anime para a lista',
    '`/anime listar [pagina]` — Lista os animes pendentes',
    '`/anime votar` — Cria uma votacao com animes pendentes',
    '`/anime sortear` — Sorteia um anime aleatorio',
    '`/anime assistido <titulo>` — Marca um anime como assistido',
    '`/anime avaliar <titulo> <nota>` — Avalia um anime (0-10)',
    '`/anime ranking` — Ranking dos animes mais bem avaliados',
  ]},
  animacao: { emoji: '🎠', label: 'Animacao', cmds: [
    '`/animacao sugerir <titulo>` — Sugere uma animacao para a lista',
    '`/animacao listar [pagina]` — Lista as animacoes pendentes',
    '`/animacao votar` — Cria uma votacao com animacoes pendentes',
    '`/animacao sortear` — Sorteia uma animacao aleatoria',
    '`/animacao assistido <titulo>` — Marca uma animacao como assistida',
    '`/animacao avaliar <titulo> <nota>` — Avalia uma animacao (0-10)',
    '`/animacao ranking` — Ranking das animacoes mais bem avaliadas',
  ]},
  jogo:     { emoji: '🎮', label: 'Jogo',     cmds: [
    '`/jogo lfg <nome> [mensagem] [role]` — Chama pra jogar um jogo',
    '`/jogo times [quantidade]` — Divide a call em times',
    '`/jogo placar <nome> <vencedor> <perdedor>` — Registra resultado de partida',
    '`/jogo ranking` — Ranking geral de vitorias',
    '`/jogo sortear` — Sorteia um jogo da lista',
    '`/jogo sorteio <user1> <user2> ...` — Sorteia um participante',
  ]},
  geral:    { emoji: '📣', label: 'Geral',    cmds: [
    '`/evento <tipo> <titulo> <descricao> [data] [ping] [imagem]` — Cria aviso de evento (admin)',
  ]},
};

const builder = new SlashCommandBuilder()
  .setName('ajuda')
  .setDescription('Mostra os comandos disponiveis');

Object.entries(CATEGORIAS).forEach(([key, cat]) => {
  builder.addSubcommand(sub => sub
    .setName(key)
    .setDescription(`Comandos de ${cat.label}`)
  );
});

module.exports = {
  data: builder,

  async execute(interaction) {
    const sub = interaction.options.getSubcommand(false);
    const catInfo = sub ? CATEGORIAS[sub] : null;

    if (catInfo) {
      const embed = new EmbedBuilder()
        .setTitle(`${catInfo.emoji} Comandos — ${catInfo.label}`)
        .setColor(0x5865F2)
        .setDescription(catInfo.cmds.join('\n\n'))
        .setFooter({ text: '/ajuda para ver categorias' });
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const cats = Object.entries(CATEGORIAS)
      .map(([key, c]) => `${c.emoji} **${c.label}** — \`/ajuda ${key}\``)
      .join('\n');

    const embed = new EmbedBuilder()
      .setTitle('Viordles — Categorias')
      .setColor(0x5865F2)
      .setDescription(cats)
      .setFooter({ text: 'Use /ajuda <categoria> para ver os comandos' });

    interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

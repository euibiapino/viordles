const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  global: true,
  data: new SlashCommandBuilder()
    .setName('ajuda')
    .setDescription('Mostra os comandos disponíveis'),

  async execute(interaction) {
    const bot = interaction.client.user;

    const embed = new EmbedBuilder()
      .setTitle('Viordles — Comandos')
      .setColor(0x5865F2)
      .setThumbnail(bot.displayAvatarURL())
      .addFields(
        {
          name: '🎬 Filme · 📺 Série · ⛩️ Anime · 🎠 Animação',
          value: [
            '`/sugerir` — Adiciona à lista de pendentes',
            '`/listar` — Lista os pendentes (com paginação)',
            '`/votar` — Cria uma votação com títulos aleatórios',
            '`/sortear` — Sorteia um título da lista',
            '`/assistido` — Marca como assistido',
            '`/avaliar` — Avalia de 0 a 10',
            '`/ranking` — Ranking dos mais bem avaliados',
          ].join('\n'),
        },
        {
          name: '🎮 Jogo',
          value: [
            '`/jogo lg` — Chama o grupo pra jogar',
            '`/jogo times` — Divide a call em times aleatórios',
            '`/jogo placar` — Registra resultado de uma partida',
            '`/jogo ranking` — Ranking geral de vitórias',
            '`/jogo sorteio` — Sorteia um participante entre os mencionados',
          ].join('\n'),
        },
        {
          name: '📣 Geral',
          value: [
            '`/evento` — Cria um aviso de evento *(admin)*',
            '`/enquete` — Cria uma enquete com opções personalizadas',
          ].join('\n'),
        },
      )
      .setFooter({ text: 'Use / para ver as opções de cada comando' });

    interaction.reply({ embeds: [embed], flags: 64 });
  },
};

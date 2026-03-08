const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const pool = require('../db/pool');
const { searchGame } = require('../utils/rawg');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('jogo')
    .setDescription('Comandos de jogos')
    .addSubcommand(sub => sub
      .setName('lg')
      .setDescription('Chama pra jogar um jogo especifico')
      .addStringOption(opt => opt.setName('nome').setDescription('Nome do jogo').setRequired(true))
      .addStringOption(opt => opt.setName('mensagem').setDescription('Mensagem adicional'))
      .addRoleOption(opt => opt.setName('role').setDescription('Role para mencionar (padrao: @here)')))
    .addSubcommand(sub => sub
      .setName('times')
      .setDescription('Divide quem esta na call em times')
      .addIntegerOption(opt => opt.setName('quantidade').setDescription('Numero de times').setMinValue(2).setMaxValue(20)))
    .addSubcommand(sub => sub
      .setName('placar')
      .setDescription('Registra resultado de uma partida')
      .addStringOption(opt => opt.setName('nome').setDescription('Nome do jogo').setRequired(true))
      .addUserOption(opt => opt.setName('vencedor').setDescription('Vencedor da partida').setRequired(true))
      .addUserOption(opt => opt.setName('perdedor').setDescription('Perdedor da partida').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('ranking')
      .setDescription('Ranking de vitorias nos jogos'))
    .addSubcommand(sub => sub
      .setName('sorteio')
      .setDescription('Sorteia um participante entre os mencionados')
      .addUserOption(opt => opt.setName('user1').setDescription('Participante 1').setRequired(true))
      .addUserOption(opt => opt.setName('user2').setDescription('Participante 2').setRequired(true))
      .addUserOption(opt => opt.setName('user3').setDescription('Participante 3'))
      .addUserOption(opt => opt.setName('user4').setDescription('Participante 4'))
      .addUserOption(opt => opt.setName('user5').setDescription('Participante 5'))
      .addUserOption(opt => opt.setName('user6').setDescription('Participante 6'))
      .addUserOption(opt => opt.setName('user7').setDescription('Participante 7'))
      .addUserOption(opt => opt.setName('user8').setDescription('Participante 8'))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'lg') return executeLg(interaction);
    if (sub === 'times') return executeTimes(interaction);
    if (sub === 'placar') return executePlacar(interaction);
    if (sub === 'ranking') return executeRanking(interaction);
    if (sub === 'sorteio') return executeSorteio(interaction);
  },
};

async function executeLg(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const game = interaction.options.getString('nome');
  const extra = interaction.options.getString('mensagem');
  const role = interaction.options.getRole('role');
  const ping = role ? role.toString() : '@here';

  const imageUrl = await searchGame(game);

  const descricao = extra
    ? `${interaction.user} quer jogar **${game}**.\n\n${extra}`
    : `${interaction.user} quer jogar **${game}**. Quem ta dentro?`;

  const embed = new EmbedBuilder()
    .setTitle('Procurando por Grupo!')
    .setColor(0x57F287)
    .setDescription(descricao)
    .setFooter({ text: 'Reaja com ✅ para entrar' });

  if (imageUrl) embed.setImage(imageUrl);

  const msg = await interaction.channel.send({ content: ping, embeds: [embed] });
  await msg.react('✅');
  await interaction.deleteReply();
}

async function executeTimes(interaction) {
  await interaction.deferReply();

  const voiceChannel = interaction.member.voice.channel;
  if (!voiceChannel) {
    const embed = new EmbedBuilder().setColor(0xED4245).setDescription('Voce precisa estar em um canal de voz!');
    return interaction.editReply({ embeds: [embed] });
  }

  const members = [...voiceChannel.members.values()]
    .filter(m => !m.user.bot)
    .map(m => m.user.username);

  if (members.length < 2) {
    const embed = new EmbedBuilder().setColor(0xED4245).setDescription('Precisa de pelo menos 2 pessoas na call!');
    return interaction.editReply({ embeds: [embed] });
  }

  const numTeams = interaction.options.getInteger('quantidade') || 2;
  if (numTeams < 2 || numTeams > members.length) {
    const embed = new EmbedBuilder().setColor(0xED4245).setDescription(`Numero de times deve ser entre 2 e ${members.length}.`);
    return interaction.editReply({ embeds: [embed] });
  }

  const shuffled = [...members];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
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

  interaction.editReply({ embeds: [embed] });
}

async function executePlacar(interaction) {
  await interaction.deferReply();

  const gameName = interaction.options.getString('nome');
  const winner = interaction.options.getUser('vencedor');
  const loser = interaction.options.getUser('perdedor');

  const game = await pool.query(
    'INSERT INTO games (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = $1 RETURNING id',
    [gameName.toLowerCase()]
  );

  await pool.query(
    'INSERT INTO game_scores (game_id, winner_id, winner_name, loser_id, loser_name) VALUES ($1, $2, $3, $4, $5)',
    [game.rows[0].id, winner.id, winner.username, loser.id, loser.username]
  );

  const embed = new EmbedBuilder()
    .setTitle('Partida Registrada!')
    .setColor(0x57F287)
    .addFields(
      { name: 'Jogo', value: gameName, inline: true },
      { name: 'Vencedor', value: winner.username, inline: true },
      { name: 'Perdedor', value: loser.username, inline: true }
    );

  interaction.editReply({ embeds: [embed] });
}

async function executeRanking(interaction) {
  await interaction.deferReply();

  const result = await pool.query(`
    SELECT winner_name as nome, COUNT(*) as vitorias
    FROM game_scores
    GROUP BY winner_id, winner_name
    ORDER BY vitorias DESC
    LIMIT 10
  `);

  if (result.rows.length === 0) {
    const embed = new EmbedBuilder().setColor(0xED4245).setDescription('Nenhuma partida registrada ainda!');
    return interaction.editReply({ embeds: [embed] });
  }

  const medals = ['🥇', '🥈', '🥉'];
  const list = result.rows
    .map((r, i) => `${medals[i] || `**${i + 1}.**`} ${r.nome} — ${r.vitorias} vitoria${r.vitorias > 1 ? 's' : ''}`)
    .join('\n');

  const embed = new EmbedBuilder()
    .setTitle('Ranking Geral de Jogos')
    .setColor(0xFEE75C)
    .setDescription(list);

  interaction.editReply({ embeds: [embed] });
}

async function executeSorteio(interaction) {
  await interaction.deferReply();

  const userKeys = ['user1','user2','user3','user4','user5','user6','user7','user8'];
  const mentions = userKeys
    .map(k => interaction.options.getUser(k))
    .filter(u => u !== null && !u.bot);

  if (mentions.length < 2) {
    const embed = new EmbedBuilder().setColor(0xED4245).setDescription('Mencione pelo menos 2 participantes!');
    return interaction.editReply({ embeds: [embed] });
  }

  const vencedor = mentions[Math.floor(Math.random() * mentions.length)];

  const embed = new EmbedBuilder()
    .setTitle('🎲 Sorteio!')
    .setColor(0xFEE75C)
    .setDescription(`O sorteado foi **${vencedor}**!`)
    .setThumbnail(vencedor.displayAvatarURL({ size: 256 }))
    .addFields({ name: '👥 Participantes', value: mentions.map(u => u.username).join(', ') })
    .setTimestamp();

  interaction.editReply({ embeds: [embed] });
}

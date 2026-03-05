const pool = require('../../db/pool');

module.exports = {
  name: 'rankingjogos',
  description: 'Mostra o ranking de vitorias',
  usage: '!rankingjogos [jogo]',
  async execute(message, args) {
    const gameName = args.join(' ').trim();
    let result;

    if (gameName) {
      result = await pool.query(`
        SELECT s.winner_name as nome, COUNT(*) as vitorias
        FROM game_scores s
        JOIN games g ON g.id = s.game_id
        WHERE LOWER(g.name) = LOWER($1)
        GROUP BY s.winner_id, s.winner_name
        ORDER BY vitorias DESC
        LIMIT 10
      `, [gameName]);
    } else {
      result = await pool.query(`
        SELECT winner_name as nome, COUNT(*) as vitorias
        FROM game_scores
        GROUP BY winner_id, winner_name
        ORDER BY vitorias DESC
        LIMIT 10
      `);
    }

    if (result.rows.length === 0) {
      return message.reply('Nenhuma partida registrada ainda!');
    }

    const title = gameName ? `Ranking de ${gameName}` : 'Ranking Geral';
    const list = result.rows
      .map((r, i) => `**${i + 1}.** ${r.nome} - ${r.vitorias} vitoria${r.vitorias > 1 ? 's' : ''}`)
      .join('\n');

    message.reply(`**${title}:**\n${list}`);
  },
};

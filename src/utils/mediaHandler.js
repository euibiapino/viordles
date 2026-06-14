const { EmbedBuilder } = require('discord.js');
const pool = require('../db/pool');
const { searchMedia } = require('./tmdb');

const NUMBER_EMOJIS = [
  '1\u20E3',
  '2\u20E3',
  '3\u20E3',
  '4\u20E3',
  '5\u20E3',
  '6\u20E3',
  '7\u20E3',
  '8\u20E3',
  '9\u20E3',
  '\uD83D\uDD1F',
];

function searchDB(query, mediaType) {
  return pool.query(
    'SELECT * FROM movies WHERE (LOWER(title) = LOWER($1) OR LOWER(original_title) = LOWER($1)) AND media_type = $2 LIMIT 1',
    [query, mediaType],
  );
}

function searchDBPartial(query, mediaType) {
  return pool.query(
    "SELECT * FROM movies WHERE (LOWER(title) LIKE '%' || LOWER($1) || '%' OR LOWER(original_title) LIKE '%' || LOWER($1) || '%') AND media_type = $2 ORDER BY created_at LIMIT 5",
    [query, mediaType],
  );
}

async function findInList(query, mediaType, tmdbType) {
  const exact = await searchDB(query, mediaType);
  if (exact.rows.length > 0) return { match: exact.rows[0], multiple: false };

  const partial = await searchDBPartial(query, mediaType);
  if (partial.rows.length === 1) return { match: partial.rows[0], multiple: false };
  if (partial.rows.length > 1) return { match: null, multiple: true, options: partial.rows };

  if (tmdbType) {
    const tmdb = await searchMedia(query, tmdbType);
    if (tmdb?.title && tmdb.title.toLowerCase() !== query.toLowerCase()) {
      const retry = await searchDB(tmdb.title, mediaType);
      if (retry.rows.length > 0) return { match: retry.rows[0], multiple: false };
    }
  }

  return { match: null, multiple: false };
}

function multipleResultsEmbed(options) {
  const list = options.map((m, i) => `**${i + 1}.** ${m.title}`).join('\n');
  return new EmbedBuilder()
    .setColor(0xfee75c)
    .setTitle('Varios resultados encontrados')
    .setDescription(`${list}\n\nSeja mais especifico!`);
}

async function executeSugerir(interaction, titulo, config) {
  await interaction.deferReply();

  const existing = await pool.query(
    'SELECT id FROM movies WHERE LOWER(title) = LOWER($1) AND media_type = $2',
    [titulo, config.type],
  );
  if (existing.rows.length > 0) {
    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setDescription(`**${titulo}** ja esta na lista!`);
    return interaction.editReply({ embeds: [embed] });
  }

  const tmdb = await searchMedia(titulo, config.tmdbType);
  const displayTitle = tmdb?.title || titulo;
  const originalTitle = tmdb?.originalTitle || null;
  const posterUrl = tmdb?.poster || null;

  await pool.query(
    'INSERT INTO movies (title, original_title, suggested_by, poster_url, media_type) VALUES ($1, $2, $3, $4, $5)',
    [displayTitle, originalTitle, interaction.user.username, posterUrl, config.type],
  );

  const embed = new EmbedBuilder()
    .setTitle(`${config.emoji} Adicionado a Lista!`)
    .setColor(0x57f287)
    .addFields(
      { name: config.label, value: displayTitle, inline: true },
      { name: 'Sugerido por', value: interaction.user.username, inline: true },
    )
    .setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL() })
    .setTimestamp();

  if (posterUrl) embed.setThumbnail(posterUrl);
  if (tmdb?.overview) embed.setDescription(`*${tmdb.overview.substring(0, 150)}...*`);
  if (tmdb?.year) embed.addFields({ name: 'Ano', value: tmdb.year, inline: true });

  interaction.editReply({ embeds: [embed] });
}

async function executeListar(interaction, pagina, config) {
  await interaction.deferReply();

  const result = await pool.query(
    'SELECT title, suggested_by FROM movies WHERE watched = FALSE AND media_type = $1 ORDER BY created_at',
    [config.type],
  );

  if (result.rows.length === 0) {
    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setDescription(
        `Nenhum(a) ${config.label} na lista! Use \`/${config.type} sugerir\` para adicionar.`,
      );
    return interaction.editReply({ embeds: [embed] });
  }

  const PAGE_SIZE = 20;
  const totalPages = Math.ceil(result.rows.length / PAGE_SIZE);
  const page = Math.min(Math.max(pagina || 1, 1), totalPages);
  const slice = result.rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const list = slice
    .map((m, i) => `**${(page - 1) * PAGE_SIZE + i + 1}.** ${m.title} — *${m.suggested_by}*`)
    .join('\n');

  const embed = new EmbedBuilder()
    .setTitle(`${config.emoji} ${config.labelPlural} Pendentes`)
    .setColor(0x5865f2)
    .setDescription(list)
    .setFooter({ text: `Pagina ${page}/${totalPages} • ${result.rows.length} no total` })
    .setTimestamp();

  interaction.editReply({ embeds: [embed] });
}

async function executeVotar(interaction, config) {
  await interaction.deferReply({ flags: 64 });

  const result = await pool.query(
    'SELECT title FROM movies WHERE watched = FALSE AND media_type = $1 ORDER BY RANDOM() LIMIT 10',
    [config.type],
  );

  if (result.rows.length === 0) {
    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setDescription(`Nenhum(a) ${config.label} na lista para votar!`);
    return interaction.editReply({ embeds: [embed] });
  }

  const items = result.rows.slice(0, NUMBER_EMOJIS.length);
  const list = items.map((m, i) => `${NUMBER_EMOJIS[i]} ${m.title}`).join('\n');

  const embed = new EmbedBuilder()
    .setTitle(`🗳️ Vote no(a) Proximo(a) ${config.label}!`)
    .setColor(0xfee75c)
    .setDescription(list)
    .setFooter({ text: 'Reaja com o numero da sua escolha' });

  const poll = await interaction.channel.send({ embeds: [embed] });
  for (let i = 0; i < items.length; i++) await poll.react(NUMBER_EMOJIS[i]);

  await interaction.deleteReply();
}

async function executeSortear(interaction, config) {
  await interaction.deferReply();

  const result = await pool.query(
    'SELECT title, suggested_by, poster_url FROM movies WHERE watched = FALSE AND media_type = $1 ORDER BY RANDOM() LIMIT 1',
    [config.type],
  );

  if (result.rows.length === 0) {
    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setDescription(`Nenhum(a) ${config.label} na lista para sortear!`);
    return interaction.editReply({ embeds: [embed] });
  }

  const item = result.rows[0];
  const embed = new EmbedBuilder()
    .setTitle(`🎲 ${config.label} Sorteado(a)!`)
    .setColor(0x57f287)
    .addFields(
      { name: `${config.emoji} ${config.label}`, value: item.title, inline: true },
      { name: '👤 Sugerido por', value: item.suggested_by, inline: true },
    )
    .setTimestamp();

  if (item.poster_url) embed.setImage(item.poster_url);
  interaction.editReply({ embeds: [embed] });
}

async function executeAssistido(interaction, titulo, config) {
  await interaction.deferReply();

  const { match, multiple, options } = await findInList(titulo, config.type, config.tmdbType);

  if (multiple) return interaction.editReply({ embeds: [multipleResultsEmbed(options)] });

  if (!match || match.watched) {
    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setDescription(`Nao encontrei **${titulo}** na lista de pendentes.`);
    return interaction.editReply({ embeds: [embed] });
  }

  await pool.query('UPDATE movies SET watched = TRUE, watched_at = NOW() WHERE id = $1', [
    match.id,
  ]);

  const embed = new EmbedBuilder()
    .setTitle(`✅ ${config.label} Assistido(a)!`)
    .setColor(0x57f287)
    .setDescription(`**${match.title}** marcado(a) como assistido(a)!`)
    .setFooter({ text: `Use /${config.type} avaliar para avaliar` })
    .setTimestamp();

  if (match.poster_url) embed.setThumbnail(match.poster_url);
  interaction.editReply({ embeds: [embed] });
}

async function executeAvaliar(interaction, titulo, rating, config) {
  await interaction.deferReply();

  const { match, multiple, options } = await findInList(titulo, config.type, config.tmdbType);

  if (multiple) return interaction.editReply({ embeds: [multipleResultsEmbed(options)] });

  if (!match) {
    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setDescription(`Nao encontrei **${titulo}** na lista.`);
    return interaction.editReply({ embeds: [embed] });
  }

  if (!match.watched) {
    await pool.query('UPDATE movies SET watched = TRUE, watched_at = NOW() WHERE id = $1', [
      match.id,
    ]);
  }

  await pool.query(
    `INSERT INTO movie_ratings (movie_id, user_id, username, rating)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (movie_id, user_id) DO UPDATE SET rating = $4`,
    [match.id, interaction.user.id, interaction.user.username, rating],
  );

  const filled = Math.round(rating / 2);
  const stars = '★'.repeat(filled) + '☆'.repeat(5 - filled);

  const embed = new EmbedBuilder()
    .setTitle('⭐ Avaliacao Registrada!')
    .setColor(0xfee75c)
    .addFields(
      { name: `${config.emoji} ${config.label}`, value: match.title, inline: true },
      { name: '👤 Por', value: interaction.user.username, inline: true },
      { name: '🎯 Nota', value: `**${rating}/10** ${stars}`, inline: false },
    )
    .setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL() })
    .setTimestamp();

  if (match.poster_url) embed.setThumbnail(match.poster_url);
  interaction.editReply({ embeds: [embed] });
}

async function executeRanking(interaction, config) {
  await interaction.deferReply();

  const result = await pool.query(
    `
    SELECT m.title, m.poster_url, ROUND(AVG(r.rating), 1) as media, COUNT(r.id) as votos
    FROM movies m
    JOIN movie_ratings r ON r.movie_id = m.id
    WHERE m.watched = TRUE AND m.media_type = $1
    GROUP BY m.id, m.title, m.poster_url
    ORDER BY media DESC, votos DESC
    LIMIT 10
  `,
    [config.type],
  );

  if (result.rows.length === 0) {
    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setDescription(`Nenhum(a) ${config.label} avaliado(a) ainda!`);
    return interaction.editReply({ embeds: [embed] });
  }

  const medals = ['🥇', '🥈', '🥉'];
  const list = result.rows
    .map(
      (m, i) =>
        `${medals[i] || `**${i + 1}.**`} ${m.title} — ${m.media}/10 *(${m.votos} voto${m.votos > 1 ? 's' : ''})*`,
    )
    .join('\n');

  const embed = new EmbedBuilder()
    .setTitle(`🏆 Ranking de ${config.labelPlural}`)
    .setColor(0xfee75c)
    .setDescription(list)
    .setTimestamp();

  if (result.rows[0].poster_url) embed.setThumbnail(result.rows[0].poster_url);
  interaction.editReply({ embeds: [embed] });
}

module.exports = {
  executeSugerir,
  executeListar,
  executeVotar,
  executeSortear,
  executeAssistido,
  executeAvaliar,
  executeRanking,
};

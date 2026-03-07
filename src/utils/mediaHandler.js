const { EmbedBuilder } = require('discord.js');
const pool = require('../db/pool');
const { searchMedia } = require('./tmdb');

const NUMBER_EMOJIS = ['1\u20E3','2\u20E3','3\u20E3','4\u20E3','5\u20E3','6\u20E3','7\u20E3','8\u20E3','9\u20E3','\uD83D\uDD1F'];

async function findInList(query, mediaType) {
  const exact = await pool.query(
    'SELECT * FROM movies WHERE (LOWER(title) = LOWER($1) OR LOWER(original_title) = LOWER($1)) AND media_type = $2 LIMIT 1',
    [query, mediaType]
  );
  if (exact.rows.length > 0) return { match: exact.rows[0], multiple: false };

  const partial = await pool.query(
    "SELECT * FROM movies WHERE (LOWER(title) LIKE '%' || LOWER($1) || '%' OR LOWER(original_title) LIKE '%' || LOWER($1) || '%') AND media_type = $2 ORDER BY created_at LIMIT 5",
    [query, mediaType]
  );
  if (partial.rows.length === 0) return { match: null, multiple: false };
  if (partial.rows.length === 1) return { match: partial.rows[0], multiple: false };
  return { match: null, multiple: true, options: partial.rows };
}

function multipleResultsEmbed(options) {
  const list = options.map((m, i) => `**${i + 1}.** ${m.title}`).join('\n');
  return new EmbedBuilder()
    .setColor(0xFEE75C)
    .setTitle('Varios resultados encontrados')
    .setDescription(`${list}\n\nSeja mais especifico!`);
}

async function executeSugerir(message, args, config) {
  const title = args.join(' ').trim();
  if (!title) {
    const embed = new EmbedBuilder().setColor(0xED4245).setDescription(`Uso: \`!${config.cmdSugerir} <nome>\``);
    return message.reply({ embeds: [embed] });
  }

  const existing = await pool.query(
    'SELECT id FROM movies WHERE LOWER(title) = LOWER($1) AND media_type = $2',
    [title, config.type]
  );
  if (existing.rows.length > 0) {
    const embed = new EmbedBuilder().setColor(0xED4245).setDescription(`**${title}** ja esta na lista!`);
    return message.reply({ embeds: [embed] });
  }

  const tmdb = await searchMedia(title, config.tmdbType);
  const displayTitle = tmdb?.title || title;
  const originalTitle = tmdb?.originalTitle || null;
  const posterUrl = tmdb?.poster || null;

  await pool.query(
    'INSERT INTO movies (title, original_title, suggested_by, poster_url, media_type) VALUES ($1, $2, $3, $4, $5)',
    [displayTitle, originalTitle, message.author.username, posterUrl, config.type]
  );

  const embed = new EmbedBuilder()
    .setTitle(`${config.emoji} Adicionado a Lista!`)
    .setColor(0x57F287)
    .addFields(
      { name: config.label, value: displayTitle, inline: true },
      { name: 'Sugerido por', value: message.author.username, inline: true }
    )
    .setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL() })
    .setTimestamp();

  if (posterUrl) embed.setThumbnail(posterUrl);
  if (tmdb?.overview) embed.setDescription(`*${tmdb.overview.substring(0, 150)}...*`);
  if (tmdb?.year) embed.addFields({ name: 'Ano', value: tmdb.year, inline: true });

  message.reply({ embeds: [embed] });
}

async function executeListar(message, args, config) {
  const result = await pool.query(
    'SELECT title, suggested_by FROM movies WHERE watched = FALSE AND media_type = $1 ORDER BY created_at',
    [config.type]
  );

  if (result.rows.length === 0) {
    const embed = new EmbedBuilder().setColor(0xED4245).setDescription(`Nenhum(a) ${config.label} na lista! Use \`!${config.cmdSugerir} <nome>\` para adicionar.`);
    return message.reply({ embeds: [embed] });
  }

  const PAGE_SIZE = 20;
  const totalPages = Math.ceil(result.rows.length / PAGE_SIZE);
  const page = Math.min(Math.max(parseInt(args[0]) || 1, 1), totalPages);
  const slice = result.rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const list = slice.map((m, i) => `**${(page - 1) * PAGE_SIZE + i + 1}.** ${m.title} — *${m.suggested_by}*`).join('\n');

  const embed = new EmbedBuilder()
    .setTitle(`${config.emoji} ${config.labelPlural} Pendentes`)
    .setColor(0x5865F2)
    .setDescription(list)
    .setFooter({ text: `Pagina ${page}/${totalPages} • ${result.rows.length} no total` })
    .setTimestamp();

  message.reply({ embeds: [embed] });
}

async function executeVotar(message, args, config) {
  const result = await pool.query(
    'SELECT title FROM movies WHERE watched = FALSE AND media_type = $1 ORDER BY RANDOM() LIMIT 10',
    [config.type]
  );

  if (result.rows.length === 0) {
    const embed = new EmbedBuilder().setColor(0xED4245).setDescription(`Nenhum(a) ${config.label} na lista para votar!`);
    return message.reply({ embeds: [embed] });
  }

  const list = result.rows.map((m, i) => `${NUMBER_EMOJIS[i]} ${m.title}`).join('\n');

  const embed = new EmbedBuilder()
    .setTitle(`🗳️ Vote no(a) Proximo(a) ${config.label}!`)
    .setColor(0xFEE75C)
    .setDescription(list)
    .setFooter({ text: 'Reaja com o numero da sua escolha' });

  const poll = await message.channel.send({ embeds: [embed] });
  for (let i = 0; i < result.rows.length; i++) await poll.react(NUMBER_EMOJIS[i]);
}

async function executeSortear(message, args, config) {
  const result = await pool.query(
    'SELECT title, suggested_by, poster_url FROM movies WHERE watched = FALSE AND media_type = $1 ORDER BY RANDOM() LIMIT 1',
    [config.type]
  );

  if (result.rows.length === 0) {
    const embed = new EmbedBuilder().setColor(0xED4245).setDescription(`Nenhum(a) ${config.label} na lista para sortear!`);
    return message.reply({ embeds: [embed] });
  }

  const item = result.rows[0];
  const embed = new EmbedBuilder()
    .setTitle(`🎲 ${config.label} Sorteado(a)!`)
    .setColor(0x57F287)
    .addFields(
      { name: `${config.emoji} ${config.label}`, value: item.title, inline: true },
      { name: '👤 Sugerido por', value: item.suggested_by, inline: true }
    )
    .setTimestamp();

  if (item.poster_url) embed.setImage(item.poster_url);
  message.reply({ embeds: [embed] });
}

async function executeAssistido(message, args, config) {
  const query = args.join(' ').trim();
  if (!query) {
    const embed = new EmbedBuilder().setColor(0xED4245).setDescription(`Uso: \`!${config.cmdAssistido} <nome>\``);
    return message.reply({ embeds: [embed] });
  }

  const { match, multiple, options } = await findInList(query, config.type);

  if (multiple) return message.reply({ embeds: [multipleResultsEmbed(options)] });

  if (!match || match.watched) {
    const embed = new EmbedBuilder().setColor(0xED4245).setDescription(`Nao encontrei **${query}** na lista de pendentes.`);
    return message.reply({ embeds: [embed] });
  }

  await pool.query('UPDATE movies SET watched = TRUE, watched_at = NOW() WHERE id = $1', [match.id]);

  const embed = new EmbedBuilder()
    .setTitle(`✅ ${config.label} Assistido(a)!`)
    .setColor(0x57F287)
    .setDescription(`**${match.title}** marcado(a) como assistido(a)!`)
    .setFooter({ text: `Use !${config.cmdAvaliar} ${match.title} <nota> para avaliar` })
    .setTimestamp();

  if (match.poster_url) embed.setThumbnail(match.poster_url);
  message.reply({ embeds: [embed] });
}

async function executeAvaliar(message, args, config) {
  if (args.length < 2) {
    const embed = new EmbedBuilder().setColor(0xED4245).setDescription(`Uso: \`!${config.cmdAvaliar} <nome> <nota>\``);
    return message.reply({ embeds: [embed] });
  }

  const rating = parseFloat(args[args.length - 1]);
  const query = args.slice(0, -1).join(' ').trim();

  if (isNaN(rating) || rating < 0 || rating > 10) {
    const embed = new EmbedBuilder().setColor(0xED4245).setDescription('A nota deve ser um numero entre 0 e 10.');
    return message.reply({ embeds: [embed] });
  }

  const { match, multiple, options } = await findInList(query, config.type);

  if (multiple) return message.reply({ embeds: [multipleResultsEmbed(options)] });

  if (!match) {
    const embed = new EmbedBuilder().setColor(0xED4245).setDescription(`Nao encontrei **${query}** na lista.`);
    return message.reply({ embeds: [embed] });
  }

  if (!match.watched) {
    await pool.query('UPDATE movies SET watched = TRUE, watched_at = NOW() WHERE id = $1', [match.id]);
  }

  await pool.query(
    `INSERT INTO movie_ratings (movie_id, user_id, username, rating)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (movie_id, user_id) DO UPDATE SET rating = $4`,
    [match.id, message.author.id, message.author.username, rating]
  );

  const filled = Math.round(rating / 2);
  const stars = '★'.repeat(filled) + '☆'.repeat(5 - filled);

  const embed = new EmbedBuilder()
    .setTitle('⭐ Avaliacao Registrada!')
    .setColor(0xFEE75C)
    .addFields(
      { name: `${config.emoji} ${config.label}`, value: match.title, inline: true },
      { name: '👤 Por', value: message.author.username, inline: true },
      { name: '🎯 Nota', value: `**${rating}/10** ${stars}`, inline: false }
    )
    .setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL() })
    .setTimestamp();

  if (match.poster_url) embed.setThumbnail(match.poster_url);
  message.reply({ embeds: [embed] });
}

async function executeRanking(message, args, config) {
  const result = await pool.query(`
    SELECT m.title, m.poster_url, ROUND(AVG(r.rating), 1) as media, COUNT(r.id) as votos
    FROM movies m
    JOIN movie_ratings r ON r.movie_id = m.id
    WHERE m.watched = TRUE AND m.media_type = $1
    GROUP BY m.id, m.title, m.poster_url
    ORDER BY media DESC, votos DESC
    LIMIT 10
  `, [config.type]);

  if (result.rows.length === 0) {
    const embed = new EmbedBuilder().setColor(0xED4245).setDescription(`Nenhum(a) ${config.label} avaliado(a) ainda!`);
    return message.reply({ embeds: [embed] });
  }

  const medals = ['🥇', '🥈', '🥉'];
  const list = result.rows
    .map((m, i) => `${medals[i] || `**${i + 1}.**`} ${m.title} — ${m.media}/10 *(${m.votos} voto${m.votos > 1 ? 's' : ''})*`)
    .join('\n');

  const embed = new EmbedBuilder()
    .setTitle(`🏆 Ranking de ${config.labelPlural}`)
    .setColor(0xFEE75C)
    .setDescription(list)
    .setTimestamp();

  if (result.rows[0].poster_url) embed.setThumbnail(result.rows[0].poster_url);
  message.reply({ embeds: [embed] });
}

module.exports = { executeSugerir, executeListar, executeVotar, executeSortear, executeAssistido, executeAvaliar, executeRanking };

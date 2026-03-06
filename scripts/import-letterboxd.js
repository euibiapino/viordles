require('dotenv').config();
const fs = require('fs');
const { Pool } = require('pg');
const axios = require('axios');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

const IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

function parseCSV(content) {
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());

  return lines.slice(1).map(line => {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    return headers.reduce((obj, header, i) => {
      obj[header] = values[i] || '';
      return obj;
    }, {});
  });
}

async function searchTMDB(title, year) {
  try {
    const response = await axios.get('https://api.themoviedb.org/3/search/movie', {
      params: { api_key: process.env.TMDB_API_KEY, query: title, year, language: 'pt-BR' },
    });
    const result = response.data.results[0];
    return result?.poster_path ? `${IMAGE_BASE}${result.poster_path}` : null;
  } catch {
    return null;
  }
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function importWatchlist(filePath, username) {
  const rows = parseCSV(fs.readFileSync(filePath, 'utf-8'));
  console.log(`\nImportando watchlist: ${rows.length} filmes pendentes...`);
  let added = 0, skipped = 0;

  for (let i = 0; i < rows.length; i++) {
    const { Name: title, Year: year } = rows[i];
    if (!title) continue;

    const existing = await pool.query(
      'SELECT id FROM movies WHERE LOWER(title) = LOWER($1) AND media_type = $2',
      [title, 'filme']
    );

    if (existing.rows.length > 0) {
      process.stdout.write(`\r  [${i+1}/${rows.length}] Pulando duplicata: ${title.substring(0,40)}`);
      skipped++;
      continue;
    }

    const posterUrl = await searchTMDB(title, year);
    await pool.query(
      'INSERT INTO movies (title, suggested_by, poster_url, media_type, watched) VALUES ($1, $2, $3, $4, FALSE)',
      [title, username, posterUrl, 'filme']
    );

    process.stdout.write(`\r  [${i+1}/${rows.length}] ${title.substring(0,40).padEnd(40)} ${posterUrl ? '✓' : '-'}`);
    added++;
    await delay(260);
  }

  console.log(`\n  Adicionados: ${added} | Pulados: ${skipped}`);
}

async function importRatings(filePath, username) {
  const rows = parseCSV(fs.readFileSync(filePath, 'utf-8'));
  console.log(`\nImportando ratings: ${rows.length} filmes assistidos...`);
  let added = 0, updated = 0;

  for (let i = 0; i < rows.length; i++) {
    const { Name: title, Year: year, Rating: rawRating, Date: watchedAt } = rows[i];
    if (!title) continue;

    const rating = parseFloat(rawRating) * 2;

    const existing = await pool.query(
      'SELECT id, watched FROM movies WHERE LOWER(title) = LOWER($1) AND media_type = $2',
      [title, 'filme']
    );

    let movieId;

    if (existing.rows.length > 0) {
      movieId = existing.rows[0].id;
      await pool.query(
        'UPDATE movies SET watched = TRUE, watched_at = $1 WHERE id = $2',
        [watchedAt, movieId]
      );
      updated++;
    } else {
      const posterUrl = await searchTMDB(title, year);
      await delay(260);
      const result = await pool.query(
        'INSERT INTO movies (title, suggested_by, poster_url, media_type, watched, watched_at) VALUES ($1, $2, $3, $4, TRUE, $5) RETURNING id',
        [title, username, posterUrl, 'filme', watchedAt]
      );
      movieId = result.rows[0].id;
      added++;
    }

    if (!isNaN(rating) && rating > 0) {
      await pool.query(
        `INSERT INTO movie_ratings (movie_id, user_id, username, rating)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (movie_id, user_id) DO UPDATE SET rating = $4`,
        [movieId, 'letterboxd_' + username, username, rating]
      );
    }

    process.stdout.write(`\r  [${i+1}/${rows.length}] ${title.substring(0,40).padEnd(40)} ${rating}/10`);
  }

  console.log(`\n  Novos: ${added} | Atualizados (watchlist→assistido): ${updated}`);
}

async function main() {
  const [,, username = 'letterboxd', watchlistPath, ratingsPath] = process.argv;

  if (!watchlistPath && !ratingsPath) {
    console.log('Uso: node scripts/import-letterboxd.js <seu_nome> <watchlist.csv> <ratings.csv>');
    console.log('Exemplo: node scripts/import-letterboxd.js pintacuia watchlist.csv ratings.csv');
    process.exit(1);
  }

  try {
    if (watchlistPath && fs.existsSync(watchlistPath)) await importWatchlist(watchlistPath, username);
    if (ratingsPath && fs.existsSync(ratingsPath)) await importRatings(ratingsPath, username);
    console.log('\nImportacao concluida!');
  } catch (err) {
    console.error('\nErro:', err.message);
  } finally {
    await pool.end();
  }
}

main();

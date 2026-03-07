const pool = require('./pool');

async function createTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS movies (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      suggested_by TEXT NOT NULL,
      poster_url TEXT,
      media_type TEXT NOT NULL DEFAULT 'filme',
      watched BOOLEAN DEFAULT FALSE,
      watched_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS movie_ratings (
      id SERIAL PRIMARY KEY,
      movie_id INTEGER REFERENCES movies(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      rating NUMERIC(4,1) NOT NULL CHECK (rating >= 0 AND rating <= 10),
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(movie_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS games (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS game_scores (
      id SERIAL PRIMARY KEY,
      game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
      winner_id TEXT NOT NULL,
      winner_name TEXT NOT NULL,
      loser_id TEXT NOT NULL,
      loser_name TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );

    ALTER TABLE movies ADD COLUMN IF NOT EXISTS poster_url TEXT;
    ALTER TABLE movies ADD COLUMN IF NOT EXISTS media_type TEXT NOT NULL DEFAULT 'filme';
    ALTER TABLE movies ADD COLUMN IF NOT EXISTS original_title TEXT;
    ALTER TABLE movie_ratings ALTER COLUMN rating TYPE NUMERIC(4,1);
  `);
}

module.exports = { createTables };

const { z } = require('zod');

const schema = z.object({
  DISCORD_TOKEN: z.string().min(50, 'Discord token parece invalido'),
  CLIENT_ID: z.string().regex(/^\d{17,20}$/, 'CLIENT_ID deve ser um Discord snowflake'),
  GUILD_ID: z.string().regex(/^\d{17,20}$/, 'GUILD_ID deve ser um Discord snowflake'),
  DATABASE_URL: z.string().startsWith('postgresql://', 'DATABASE_URL precisa ser postgresql://'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
  TMDB_API_KEY: z.string().min(10),
  RAWG_API_KEY: z.string().min(10),
  SPOTIFY_CLIENT_ID: z.string().min(10),
  SPOTIFY_CLIENT_SECRET: z.string().min(10),
  LAVALINK_PASSWORD: z.string().min(8),
  YTDLP_PROXY: z.string().optional().default('socks5://localhost:40000'),
  HEALTH_PORT: z.coerce.number().int().positive().default(3000),
});

function load() {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    console.error(`\n[CONFIG] Variaveis de ambiente invalidas:\n${issues}\n`);
    process.exit(1);
  }
  return result.data;
}

module.exports = load();

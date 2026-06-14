require('dotenv').config({ path: process.env.ENV_FILE || '.env' });
require('./config');

const http = require('http');
const path = require('path');
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { createTables } = require('./db/schema');
const pool = require('./db/pool');
const { loadCommands } = require('./utils/loadCommands');
const { createManager, getManager } = require('./utils/lavalinkClient');
const { setBotIcon } = require('./utils/musicHandler');
const log = require('./utils/logger');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions,
  ],
});

const commands = new Collection();
loadCommands(path.join(__dirname, 'commands')).forEach((cmd) => commands.set(cmd.data.name, cmd));

client.once('clientReady', async () => {
  log.info(`Bot online como ${client.user.tag}`);
  await createTables();
  log.info('Tabelas do banco verificadas.');

  setBotIcon(client.user.displayAvatarURL({ size: 64 }));
  const manager = createManager(client);
  await manager.init({ id: client.user.id, username: client.user.username });
  log.info('Lavalink conectado.');
});

client.on('raw', (data) => {
  const manager = getManager();
  if (manager) manager.sendRawData(data);
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = commands.get(interaction.commandName);
      if (command) await command.execute(interaction);
      return;
    }
    if (interaction.isButton() && interaction.customId.startsWith('music_')) {
      const musicCmd = commands.get('musica');
      if (musicCmd) await musicCmd.handleButton(interaction);
      return;
    }
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('music_')) {
      const musicCmd = commands.get('musica');
      if (musicCmd) await musicCmd.handleSelect(interaction);
      return;
    }
  } catch (error) {
    log.error('Erro na interação:', error);
    const payload = { content: 'Ocorreu um erro ao processar essa interação.', flags: 64 };
    if (interaction.replied || interaction.deferred) {
      await interaction.editReply(payload).catch(() => {});
    } else {
      await interaction.reply(payload).catch(() => {});
    }
  }
});

process.on('unhandledRejection', (reason) => log.error('Unhandled rejection:', reason));
process.on('uncaughtException', (err) => log.error('Uncaught exception:', err));

const PORT = process.env.HEALTH_PORT || process.env.PORT || 3000;
const httpServer = http
  .createServer((req, res) => {
    res.writeHead(200);
    res.end('Bot online');
  })
  .listen(PORT, '127.0.0.1');

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info(`Recebido ${signal}, desligando…`);

  const tasks = [
    new Promise((r) => httpServer.close(() => r())),
    Promise.resolve()
      .then(() => getManager()?.destroy?.())
      .catch(() => {}),
    pool.end().catch(() => {}),
  ];
  await Promise.race([Promise.allSettled(tasks), new Promise((r) => setTimeout(r, 5_000))]);
  client.destroy().catch(() => {});
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

client.login(process.env.DISCORD_TOKEN);

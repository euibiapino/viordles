require('dotenv').config({ path: process.env.ENV_FILE || '.env' });

const http = require('http');
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const path = require('path');
const { createTables } = require('./db/schema');
const { loadCommands } = require('./utils/loadCommands');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions,
  ],
});

const commands = new Collection();
loadCommands(path.join(__dirname, 'commands')).forEach(cmd => commands.set(cmd.data.name, cmd));

client.once('ready', async () => {
  console.log(`Bot online como ${client.user.tag}`);
  await createTables();
  console.log('Tabelas do banco criadas/verificadas.');
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`Erro no comando ${interaction.commandName}:`, error);
    const payload = { content: 'Ocorreu um erro ao executar esse comando.', ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.editReply(payload).catch(() => {});
    } else {
      await interaction.reply(payload).catch(() => {});
    }
  }
});

const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Bot online');
}).listen(PORT);

client.login(process.env.DISCORD_TOKEN);

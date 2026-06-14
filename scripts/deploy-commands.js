require('dotenv').config({ path: process.env.ENV_FILE || '.env' });

const { REST, Routes } = require('discord.js');
const path = require('path');
const { loadCommands } = require('../src/utils/loadCommands');

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;
const isGlobal = process.argv.includes('--global');

if (!DISCORD_TOKEN || !CLIENT_ID) {
  console.error('Variaveis DISCORD_TOKEN e CLIENT_ID sao obrigatorias no .env');
  process.exit(1);
}
if (!isGlobal && !GUILD_ID) {
  console.error('Variavel GUILD_ID e obrigatoria no .env (ou use --global para registro global)');
  process.exit(1);
}

const commandsPath = path.join(__dirname, '..', 'src', 'commands');
const allCommands = loadCommands(commandsPath);
const filtered = isGlobal ? allCommands.filter((cmd) => cmd.global) : allCommands;
const commands = filtered.map((cmd) => {
  console.log(`Carregado: ${cmd.data.name}`);
  return cmd.data.toJSON();
});

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

(async () => {
  try {
    const route = isGlobal
      ? Routes.applicationCommands(CLIENT_ID)
      : Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID);

    console.log(
      `\nRegistrando ${commands.length} slash command(s) ${isGlobal ? 'globalmente' : `no servidor ${GUILD_ID}`}...`,
    );

    const data = await rest.put(route, { body: commands });

    console.log(`\nPronto! ${data.length} slash command(s) registrado(s) com sucesso.`);
    if (isGlobal) console.log('Comandos globais podem levar ate 1 hora para aparecer.');
  } catch (error) {
    console.error('Erro ao registrar comandos:', error);
    process.exit(1);
  }
})();

const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const pool = require('../db/pool');
const log = require('./logger');
const { loadWelcomeImage } = require('./welcomeImage');

const DEFAULT_MESSAGE = 'Olá {membro}, espero que você se divirta no meu servidor!';
const DEFAULT_GOODBYE = '**{usuario}** saiu do servidor. Até mais!';
const DEFAULT_NEW_ACCOUNT_DAYS = 7;

// Campos que o /boasvindas pode gravar. Serve de whitelist: os nomes entram
// direto no SQL, então nada fora daqui pode chegar na query.
const WRITABLE = [
  'channel_id',
  'message',
  'images',
  'enabled',
  'new_account_days',
  'goodbye_channel_id',
  'goodbye_message',
  'goodbye_enabled',
];

// Numa rajada de entradas (raid, ou divulgação que deu certo) sairia um embed
// por pessoa e o canal viraria inutilizável. Passando do limite dentro da
// janela, as entradas passam a ser agrupadas num resumo único.
const RAID_WINDOW_MS = 60_000;
const RAID_THRESHOLD = 5;
const BATCH_FLUSH_MS = 10_000;
const BATCH_NAMES_SHOWN = 15;

// Config muda raramente e é lida a cada entrada; um Map por guild evita ir ao
// banco justamente durante uma rajada.
const cache = new Map();
const joinLog = new Map();
const batches = new Map();

async function getConfig(guildId) {
  if (cache.has(guildId)) return cache.get(guildId);
  const { rows } = await pool.query('SELECT * FROM welcome_config WHERE guild_id = $1', [guildId]);
  const cfg = rows[0] ?? null;
  cache.set(guildId, cfg);
  return cfg;
}

async function setConfig(guildId, patch) {
  const keys = Object.keys(patch).filter((k) => WRITABLE.includes(k));
  if (!keys.length) return;

  const cols = keys.join(', ');
  const placeholders = keys.map((_, i) => `$${i + 2}`).join(', ');
  const updates = keys.map((k) => `${k} = EXCLUDED.${k}`).join(', ');

  await pool.query(
    `INSERT INTO welcome_config (guild_id, ${cols}) VALUES ($1, ${placeholders})
     ON CONFLICT (guild_id) DO UPDATE SET ${updates}, updated_at = NOW()`,
    [guildId, ...keys.map((k) => patch[k])],
  );
  cache.delete(guildId);
}

function renderMessage(template, member, fallback) {
  return String(template || fallback)
    .replaceAll('{membro}', member.toString())
    .replaceAll('{usuario}', member.user.username)
    .replaceAll('{servidor}', member.guild.name)
    .replaceAll('{contagem}', String(member.guild.memberCount));
}

function pickImage(cfg) {
  const images = cfg?.images ?? [];
  if (!images.length) return null;
  return images[Math.floor(Math.random() * images.length)];
}

// Conta criada há poucos dias é o sinal mais barato de raid ou descartável.
// Marca no próprio embed para a moderação ver sem precisar investigar.
function newAccountWarning(user, cfg) {
  const limite = cfg?.new_account_days ?? DEFAULT_NEW_ACCOUNT_DAYS;
  if (!limite || limite <= 0) return null;
  const dias = (Date.now() - user.createdTimestamp) / 86_400_000;
  if (dias >= limite) return null;
  return `Conta criada <t:${Math.floor(user.createdTimestamp / 1000)}:R> — vale um olhar da moderação.`;
}

function buildWelcomeEmbed(member, cfg) {
  const aviso = newAccountWarning(member.user, cfg);

  const embed = new EmbedBuilder()
    .setColor(aviso ? 0xfee75c : 0x5865f2)
    .setAuthor({ name: `@${member.user.username}`, iconURL: member.user.displayAvatarURL() })
    .setTitle('👋 Bem-vindo(a)!')
    .setDescription(renderMessage(cfg?.message, member, DEFAULT_MESSAGE))
    .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
    .setFooter({ text: `ID do usuário: ${member.id}` });

  if (aviso) embed.addFields({ name: '⚠️ Conta recente', value: aviso });

  const image = pickImage(cfg);
  if (image) embed.setImage(image);
  return embed;
}

// Anexar o arquivo evita depender do proxy de imagens externas do Discord.
async function buildWelcomePayload(member, cfg) {
  const embed = buildWelcomeEmbed(member, { ...cfg, images: [] });
  const images = cfg?.images || [];
  const first = Math.floor(Math.random() * images.length);
  for (let i = 0; i < Math.min(images.length, 3); i++) {
    try {
      const file = await loadWelcomeImage(images[(first + i) % images.length]);
      embed.setImage(`attachment://${file.name}`);
      return { embeds: [embed], files: [file] };
    } catch (e) {
      log.warn('Imagem de boas-vindas indisponível:', e.message);
    }
  }
  return { embeds: [embed] };
}

function buildGoodbyeEmbed(member, cfg) {
  return new EmbedBuilder()
    .setColor(0x99aab5)
    .setAuthor({ name: `@${member.user.username}`, iconURL: member.user.displayAvatarURL() })
    .setTitle('👋 Até mais!')
    .setDescription(renderMessage(cfg?.goodbye_message, member, DEFAULT_GOODBYE))
    .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
    .setFooter({ text: `ID do usuário: ${member.id}` });
}

function buildBatchEmbed(members, cfg) {
  const nomes = members.slice(0, BATCH_NAMES_SHOWN).map((m) => m.toString());
  const resto = members.length - nomes.length;
  const recentes = members.filter((m) => newAccountWarning(m.user, cfg)).length;

  const embed = new EmbedBuilder()
    .setColor(recentes ? 0xfee75c : 0x5865f2)
    .setTitle(`👋 ${members.length} pessoas entraram`)
    .setDescription(nomes.join(', ') + (resto > 0 ? ` e mais ${resto}.` : ''));

  if (recentes) {
    embed.addFields({
      name: '⚠️ Contas recentes',
      value: `${recentes} de ${members.length} têm conta criada há pouco tempo.`,
    });
  }
  return embed;
}

// O canal pode ter sido apagado ou perdido permissão desde que foi configurado,
// então nada aqui pode assumir que ainda dá pra postar.
const REQUIRED_PERMS = [
  { flag: PermissionFlagsBits.ViewChannel, label: 'Ver Canal' },
  { flag: PermissionFlagsBits.SendMessages, label: 'Enviar Mensagens' },
  { flag: PermissionFlagsBits.EmbedLinks, label: 'Inserir Links' },
];

function missingPermissions(channel, me) {
  const perms = channel.permissionsFor(me);
  if (!perms) return ['acesso ao canal'];
  return REQUIRED_PERMS.filter((p) => !perms.has(p.flag)).map((p) => p.label);
}

async function resolveChannel(guild, channelId) {
  if (!channelId) return null;
  const channel =
    guild.channels.cache.get(channelId) ??
    (await guild.channels.fetch(channelId).catch(() => null));
  return channel?.isTextBased?.() ? channel : null;
}

async function postTo(guild, channelId, payload) {
  const channel = await resolveChannel(guild, channelId);
  if (!channel) return;
  if (missingPermissions(channel, guild.members.me).length) return;
  if (
    payload.files?.length &&
    !channel.permissionsFor(guild.members.me)?.has(PermissionFlagsBits.AttachFiles)
  ) {
    log.warn('Boas-vindas: falta Anexar Arquivos no canal', channelId);
    delete payload.files;
    payload.embeds.forEach((embed) => embed.setImage(null));
  }
  await channel.send(payload);
}

function registerJoin(guildId) {
  const now = Date.now();
  const recentes = (joinLog.get(guildId) ?? []).filter((t) => now - t < RAID_WINDOW_MS);
  recentes.push(now);
  joinLog.set(guildId, recentes);
  return recentes.length;
}

function queueBatched(member, cfg) {
  let batch = batches.get(member.guild.id);
  if (!batch) {
    batch = { members: [], timer: null };
    batches.set(member.guild.id, batch);
  }
  batch.members.push(member);

  if (!batch.timer) {
    batch.timer = setTimeout(() => {
      flushBatch(member.guild, cfg).catch((e) => log.error('Falha ao agrupar entradas:', e));
    }, BATCH_FLUSH_MS);
    // Não deve segurar o processo no shutdown.
    batch.timer.unref?.();
  }
}

async function flushBatch(guild, cfg) {
  const batch = batches.get(guild.id);
  batches.delete(guild.id);
  if (!batch?.members.length) return;
  await postTo(guild, cfg.channel_id, { embeds: [buildBatchEmbed(batch.members, cfg)] });
}

async function handleMemberJoin(member) {
  try {
    if (member.user.bot) return;
    const cfg = await getConfig(member.guild.id);
    if (!cfg?.enabled || !cfg.channel_id) return;

    if (registerJoin(member.guild.id) > RAID_THRESHOLD) {
      queueBatched(member, cfg);
      return;
    }

    await postTo(member.guild, cfg.channel_id, {
      content: member.toString(),
      ...(await buildWelcomePayload(member, cfg)),
    });
  } catch (error) {
    log.error('Falha ao enviar boas-vindas:', error);
  }
}

async function handleMemberLeave(member) {
  try {
    if (member.user?.bot) return;
    const cfg = await getConfig(member.guild.id);
    if (!cfg?.goodbye_enabled) return;

    // Sem canal próprio de saída, cai no mesmo canal das boas-vindas.
    const channelId = cfg.goodbye_channel_id || cfg.channel_id;
    if (!channelId) return;

    await postTo(member.guild, channelId, { embeds: [buildGoodbyeEmbed(member, cfg)] });
  } catch (error) {
    log.error('Falha ao enviar mensagem de saída:', error);
  }
}

module.exports = {
  DEFAULT_MESSAGE,
  DEFAULT_GOODBYE,
  DEFAULT_NEW_ACCOUNT_DAYS,
  getConfig,
  setConfig,
  buildWelcomeEmbed,
  buildWelcomePayload,
  buildGoodbyeEmbed,
  handleMemberJoin,
  handleMemberLeave,
  missingPermissions,
  resolveChannel,
};

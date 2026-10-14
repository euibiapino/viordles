const { LavalinkManager } = require('lavalink-client');
const metrics = require('../observability/metrics');

let manager = null;

function createManager(discordClient) {
  if (!process.env.LAVALINK_PASSWORD) {
    throw new Error('LAVALINK_PASSWORD env var is required');
  }
  manager = new LavalinkManager({
    nodes: [
      {
        authorization: process.env.LAVALINK_PASSWORD,
        host: '127.0.0.1',
        port: 2333,
        id: 'main',
        retryAmount: 10,
        retryDelay: 5000,
      },
    ],
    sendToShard: (guildId, payload) => {
      const guild = discordClient.guilds.cache.get(guildId);
      if (guild) guild.shard.send(payload);
    },
    autoSkip: true,
    playerOptions: {
      applyVolumeAsFilter: false,
      onDisconnect: { autoReconnect: true, destroyPlayer: false },
      onEmptyQueue: { destroyAfterMs: 30_000 },
    },
  });

  setupEvents(discordClient);
  return manager;
}

function setupEvents(discordClient) {
  const { updateController, clearController } = require('./musicHandler');

  const log = require('./logger');
  manager.on('trackError', (player, track, payload) => {
    metrics.playback.inc({ event: 'error' });
    log.error('Falha de reprodução:', {
      requestId: track?.userData?.requestId,
      guild: player.guildId,
      title: track?.info?.title,
      position: player.position,
      message: payload.exception?.message,
    });
  });
  manager.on('trackStuck', (player, track) => {
    metrics.playback.inc({ event: 'stuck' });
    log.warn('Áudio travado:', {
      requestId: track?.userData?.requestId,
      guild: player.guildId,
      title: track?.info?.title,
      position: player.position,
    });
  });

  manager.on('trackStart', async (player, track) => {
    metrics.playback.inc({ event: 'start' });
    const data = track?.userData;
    if (data?.immediate && Number.isFinite(data.requestedAt)) {
      metrics.startup.observe(Math.max(0, (Date.now() - data.requestedAt) / 1000));
      data.immediate = false;
    }
    log.info('Reprodução iniciada', { requestId: data?.requestId });
    const channel = discordClient.channels.cache.get(player.textChannelId);
    if (channel) await updateController(player, channel);
  });

  manager.on('trackEnd', async (player) => {
    if (!player.queue.current && !player.queue.tracks?.length) {
      const is247 = player.getData('247');
      if (!is247) return;
      const channel = discordClient.channels.cache.get(player.textChannelId);
      if (channel) await clearController(player.guildId);
    }
  });

  manager.on('queueEnd', async (player) => {
    const is247 = player.getData('247');
    const channel = discordClient.channels.cache.get(player.textChannelId);
    if (!is247) {
      if (channel) await clearController(player.guildId);
    }
  });

  manager.on('playerDestroy', async (player) => {
    const { clearController: clear } = require('./musicHandler');
    await clear(player.guildId);
  });

  manager.on('playerPaused', async (player) => {
    const channel = discordClient.channels.cache.get(player.textChannelId);
    if (channel) await updateController(player, channel);
  });

  manager.on('playerResumed', async (player) => {
    const channel = discordClient.channels.cache.get(player.textChannelId);
    if (channel) await updateController(player, channel);
  });
}

function getManager() {
  return manager;
}

module.exports = { createManager, getManager };

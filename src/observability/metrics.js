const { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } = require('prom-client');
const os = require('node:os');
const registry = new Registry();
registry.setDefaultLabels({ service: 'viordles' });
collectDefaultMetrics({ register: registry, prefix: 'viordles_' });
const registers = [registry];
const durations = [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 40, 90];
const stage = new Histogram({
  name: 'viordles_stage_seconds',
  help: 'Duration by fixed operation and outcome',
  labelNames: ['operation', 'outcome'],
  buckets: durations,
  registers,
});
const cache = new Counter({
  name: 'viordles_cache_total',
  help: 'Cache lookups',
  labelNames: ['cache', 'result'],
  registers,
});
const relay = new Counter({
  name: 'viordles_relay_events_total',
  help: 'Relay events',
  labelNames: ['event'],
  registers,
});
const playback = new Counter({
  name: 'viordles_playback_events_total',
  help: 'Playback lifecycle events',
  labelNames: ['event'],
  registers,
});
const logs = new Counter({
  name: 'viordles_logs_total',
  help: 'Application logs',
  labelNames: ['level'],
  registers,
});
const startup = new Histogram({
  name: 'viordles_playback_start_seconds',
  help: 'Command to trackStart for immediately started tracks; not proof of audible output',
  buckets: durations,
  registers,
});
const lavalink = new Gauge({
  name: 'viordles_lavalink_value',
  help: 'Lavalink REST stats (frames describe last reporting interval)',
  labelNames: ['stat'],
  registers,
});
const discord = new Gauge({
  name: 'viordles_discord_ready',
  help: 'Discord client ready',
  registers,
});
const operations = new Set([
  'resolve',
  'lavalink_load',
  'relay_block',
  'command',
  'discord_ack',
  'voice_connect',
  'player_setup',
  'player_start',
]);
async function measure(operation, fn) {
  if (!operations.has(operation)) throw new Error('Unknown metric operation');
  const start = performance.now();
  let outcome = 'ok';
  try {
    return await fn();
  } catch (e) {
    outcome = 'error';
    throw e;
  } finally {
    stage.observe({ operation, outcome }, (performance.now() - start) / 1000);
  }
}
const host = new Gauge({
  name: 'viordles_host_value',
  help: 'Host memory and load',
  labelNames: ['stat'],
  registers,
});
let timer;
function start(client) {
  let busy = false;
  const sample = async () => {
    if (busy) return;
    busy = true;
    host.set({ stat: 'memory_free_bytes' }, os.freemem());
    host.set({ stat: 'memory_total_bytes' }, os.totalmem());
    host.set({ stat: 'load_1m' }, os.loadavg()[0]);
    discord.set(client.isReady() ? 1 : 0);
    try {
      const res = await fetch('http://127.0.0.1:2333/v4/stats', {
        headers: { Authorization: process.env.LAVALINK_PASSWORD },
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) throw new Error('Lavalink unavailable');
      const d = await res.json();
      lavalink.set({ stat: 'up' }, 1);
      for (const [stat, value] of Object.entries({
        players: d.players,
        playing: d.playingPlayers,
        cpu: d.cpu?.lavalinkLoad,
        memory_bytes: d.memory?.used,
        frames_deficit: d.frameStats?.deficit ?? 0,
        frames_nulled: d.frameStats?.nulled ?? 0,
      })) {
        if (Number.isFinite(value)) lavalink.set({ stat }, value);
      }
    } catch {
      lavalink.set({ stat: 'up' }, 0);
    } finally {
      busy = false;
    }
  };
  sample();
  timer = setInterval(sample, 15000);
  timer.unref();
}
function stop() {
  clearInterval(timer);
}
module.exports = { registry, stage, cache, relay, playback, logs, startup, measure, start, stop };

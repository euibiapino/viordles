const fs = require('node:fs'),
  vm = require('node:vm'),
  assert = require('node:assert/strict');
const req = require('node:module').createRequire(process.cwd() + '/src/commands/musica.js');
const helper = req('../utils/musicHandler');
const { test } = require('node:test');
test('busca avança durante conexão e Spotify não bloqueia áudio e preserva YouTube como fallback', async () => {
  for (const found of [true, false]) {
    let ackDone;
    const acknowledging = new Promise((r) => (ackDone = r));
    let connectDone;
    const connecting = new Promise((r) => (connectDone = r));
    let resolvedStarted = false;
    let release;
    const pending = new Promise((r) => (release = r));
    let played = false,
      controller;
    const replies = [];
    const track = { info: {}, userData: {} };
    const player = {
      connect: () => connecting,
      voiceChannelId: 'voice',
      queue: { current: null, tracks: [], add: async (t) => (player.queue.current = t) },
      setRepeatMode: async () => {},
      search: async () => ({ tracks: [track] }),
      play: async () => {
        played = true;
        assert.equal(track.info.artworkUrl, 'https://example.com/yt.jpg');
        assert.equal(track.info.title, 'Demi Lovato - Skyscraper (Official Video)');
      },
      volume: 100,
    };
    const interaction = {
      options: { getString: () => 'Demi Lovato Skyscraper', getSubcommand: () => 'tocar' },
      member: { voice: { channel: { id: 'voice' } } },
      guildId: 'guild',
      user: {},
      channel: {},
      deferReply: () => acknowledging,
      editReply: async (x) => replies.push(x.embeds[0].toJSON()),
    };
    const mocks = {
      '../utils/lavalinkClient': {
        getManager: () => ({ getPlayer: () => undefined, createPlayer: async () => player }),
      },
      '../utils/ytdlp': {
        resolveOne: async () => {
          resolvedStarted = true;
          return {
            title: 'Demi Lovato - Skyscraper (Official Video)',
            author: 'Demi Lovato',
            duration: 246000,
            sourceUrl: 'https://youtube.com/watch?v=test',
            streamUrl: 'https://example.com/audio',
            thumbnail: 'https://example.com/yt.jpg',
            sourceName: 'youtube',
          };
        },
        isYoutubePlaylist: () => false,
      },
      '../utils/streamRelay': { relayUrl: (x) => x },
      '../utils/spotify': { searchTrack: () => pending },
      '../utils/musicHandler': {
        ...helper,
        updateController: async (p) => (controller = helper.buildNowPlayingEmbed(p).toJSON()),
      },
      '../utils/logger': { context: () => ({}), info: () => {}, warn: () => {} },
      '../observability/metrics': { measure: async (_, f) => f() },
    };
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync('src/commands/musica.js', 'utf8'), {
      require: (x) => mocks[x] || req(x),
      module,
      exports: module.exports,
      performance,
      Date,
    });
    const run = module.exports.execute(interaction);
    await new Promise(setImmediate);
    assert.equal(resolvedStarted, true);
    ackDone();
    await new Promise(setImmediate);
    assert.equal(played, false);
    connectDone();
    await new Promise(setImmediate);
    assert.equal(played, true);
    assert.equal(replies.length, 0);
    release(
      found
        ? {
            title: 'Skyscraper',
            author: 'Demi Lovato',
            artworkUrl: 'https://example.com/spotify.jpg',
            uri: 'https://open.spotify.com/track/test',
          }
        : null,
    );
    await run;
    assert.equal(replies.length, 1);
    assert.ok(replies[0].description.includes(controller.title));
    assert.equal(replies[0].thumbnail?.url, controller.thumbnail?.url);
    assert.equal(
      controller.thumbnail?.url,
      found ? 'https://example.com/spotify.jpg' : 'https://example.com/yt.jpg',
    );
    assert.equal(track.info.duration, 246000);
    assert.equal(JSON.stringify(replies).includes('yt.jpg'), !found);
    assert.ok(!JSON.stringify(replies).includes('sem correspondência'));
  }
});

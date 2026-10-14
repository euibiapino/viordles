const { test } = require('node:test');
const assert = require('node:assert/strict');
const { updateController, clearController, controllers } = require('../src/utils/musicHandler');
const player = (id) => ({
  guildId: id,
  queue: {
    current: {
      info: { title: 'Consultando Spotify…', uri: 'https://example.com', duration: 1000 },
    },
    tracks: [],
  },
  volume: 100,
  voiceChannelId: '123',
});

test('início e metadados simultâneos criam um único card e encerramento limpa esse card', async () => {
  const p = player('race');
  let release;
  const sending = new Promise((r) => (release = r));
  let sends = 0;
  const edits = [];
  const msg = { edit: async (data) => edits.push(data) };
  const channel = {
    send: async () => {
      sends++;
      await sending;
      return msg;
    },
  };
  const first = updateController(p, channel);
  await new Promise(setImmediate);
  p.queue.current.info.title = 'Spotify title';
  const second = updateController(p, channel);
  release();
  await Promise.all([first, second]);
  assert.equal(sends, 1);
  assert.equal(edits[0].embeds[0].data.title, 'Spotify title');
  await clearController(p.guildId);
  assert.deepEqual(edits.at(-1).components, []);
  assert.equal(controllers.has(p.guildId), false);
});
test('encerramento durante envio aguarda e remove os botões da mensagem enviada', async () => {
  const p = player('ending');
  let release;
  const sending = new Promise((r) => (release = r));
  let last;
  const update = updateController(p, {
    send: async () => {
      await sending;
      return { edit: async (x) => (last = x) };
    },
  });
  await new Promise(setImmediate);
  p.queue.current = null;
  const clear = clearController(p.guildId);
  release();
  await Promise.all([update, clear]);
  assert.equal(last.embeds[0].data.title, 'Nada tocando agora');
  assert.deepEqual(last.components, []);
});
test('erro transitório ao editar preserva referência e não duplica card', async () => {
  const p = player('transient');
  const msg = {
    edit: async () => {
      throw Object.assign(new Error('network'), { code: 'ECONNRESET' });
    },
  };
  controllers.set(p.guildId, msg);
  await assert.rejects(
    updateController(p, {
      send: async () => {
        throw Error('must not send');
      },
    }),
    /network/,
  );
  assert.equal(controllers.get(p.guildId), msg);
  controllers.delete(p.guildId);
});

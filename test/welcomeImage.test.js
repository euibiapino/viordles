const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadWelcomeImage } = require('../src/utils/welcomeImage');

test('baixa GIF inteiro para anexo e reutiliza cache', async (t) => {
  let calls = 0;
  t.mock.method(global, 'fetch', async () => {
    calls++;
    return new Response('GIF89a123456', { headers: { 'content-type': 'image/gif' } });
  });
  const first = await loadWelcomeImage('https://example.com/valid.gif');
  const second = await loadWelcomeImage('https://example.com/valid.gif');
  assert.equal(first.name, 'boas-vindas.gif');
  assert.equal(first.attachment.toString(), 'GIF89a123456');
  assert.equal(first, second);
  assert.equal(calls, 1);
});

test('recusa HTML mesmo declarado como imagem e arquivos grandes', async (t) => {
  t.mock.method(
    global,
    'fetch',
    async () => new Response('<html>error</html>', { headers: { 'content-type': 'image/gif' } }),
  );
  await assert.rejects(loadWelcomeImage('https://example.com/invalid.gif'), /arquivo/);
  t.mock.restoreAll();
  t.mock.method(
    global,
    'fetch',
    async () =>
      new Response('GIF89a', {
        headers: { 'content-type': 'image/gif', 'content-length': String(9 * 1024 * 1024) },
      }),
  );
  await assert.rejects(loadWelcomeImage('https://example.com/large.gif'), /8 MiB/);
});

test('card usa anexo e tenta outra imagem quando a sorteada falha', async (t) => {
  const { buildWelcomePayload } = require('../src/utils/welcomeHandler');
  t.mock.method(Math, 'random', () => 0);
  t.mock.method(global, 'fetch', async (url) =>
    url.includes('broken')
      ? new Response('not found', { status: 404 })
      : new Response('GIF89a123456', { headers: { 'content-type': 'image/gif' } }),
  );
  const member = {
    id: '123',
    toString: () => '<@123>',
    user: {
      username: 'tester',
      createdTimestamp: 0,
      displayAvatarURL: () => 'https://example.com/avatar.png',
    },
    guild: { name: 'Test', memberCount: 1 },
  };
  const payload = await buildWelcomePayload(member, {
    images: ['https://example.com/broken.gif', 'https://example.com/fallback.gif'],
  });
  assert.equal(payload.embeds[0].toJSON().image.url, 'attachment://boas-vindas.gif');
  assert.equal(payload.files[0].attachment.toString(), 'GIF89a123456');
  const textOnly = await buildWelcomePayload(member, {
    images: ['https://example.com/broken.gif'],
  });
  assert.equal(textOnly.files, undefined);
  assert.match(textOnly.embeds[0].toJSON().description, /<@123>/);
});

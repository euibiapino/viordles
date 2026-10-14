const { test } = require('node:test');
const assert = require('node:assert/strict');
const log = require('../src/utils/logger');
const metrics = require('../src/observability/metrics');

test('logs são JSON, correlacionados e removem segredos inclusive de Error', async (t) => {
  const originalToken = process.env.DISCORD_TOKEN;
  const originalKey = process.env.TMDB_API_KEY;
  process.env.DISCORD_TOKEN = 'unique-secret-discord-token';
  process.env.TMDB_API_KEY = 'unique-secret-api-key';
  t.after(() => {
    if (originalToken === undefined) delete process.env.DISCORD_TOKEN;
    else process.env.DISCORD_TOKEN = originalToken;
    if (originalKey === undefined) delete process.env.TMDB_API_KEY;
    else process.env.TMDB_API_KEY = originalKey;
  });
  const lines = [];
  t.mock.method(console, 'log', (line) => lines.push(line));
  await log.withContext({ requestId: 'safe-id' }, async () => {
    await Promise.resolve();
    log.info('teste', {
      authorization: 'Bearer abc',
      token: 'other-secret',
      error: new Error('unique-secret-discord-token https://host/audio?sig=secret'),
      text: 'unique-secret-api-key',
    });
  });
  assert.equal(log.sanitize('Bot online'), 'Bot online');
  const record = JSON.parse(lines[0]);
  assert.equal(record.requestId, 'safe-id');
  assert.doesNotMatch(lines[0], /unique-secret|other-secret|sig=secret|Bearer abc/);
  assert.match(lines[0], /REDACTED/);
});

test('mede sucesso/falha sem labels de usuário ou música', async () => {
  assert.equal(await metrics.measure('resolve', async () => 42), 42);
  await assert.rejects(
    metrics.measure('resolve', async () => {
      throw new Error('failure');
    }),
  );
  await assert.rejects(metrics.measure('some-user-id', async () => 0));
  const text = await metrics.registry.metrics();
  assert.match(
    text,
    /viordles_stage_seconds_count\{[^\n]*operation="resolve"[^\n]*outcome="error"/,
  );
  assert.doesNotMatch(text, /some-user-id/);
});

test('limita tamanho e aceita objetos circulares sem derrubar aplicação', (t) => {
  const lines = [];
  t.mock.method(console, 'log', (line) => lines.push(line));
  const obj = {};
  obj.circular = obj;
  log.info('x'.repeat(5000), obj, Array(30).fill('y'.repeat(3000)));
  assert.ok(Buffer.byteLength(lines[0]) < 8000);
  JSON.parse(lines[0]);
});

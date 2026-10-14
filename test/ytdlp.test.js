const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const child = require('node:child_process');

test('busca simultânea compartilha processo, cache retorna cópias e URL expirada não fica em cache', async (t) => {
  const previous = process.env.YTDLP_WORKER;
  process.env.YTDLP_WORKER = 'false';
  t.after(() => {
    if (previous === undefined) delete process.env.YTDLP_WORKER;
    else process.env.YTDLP_WORKER = previous;
  });
  let calls = 0;
  t.mock.method(child, 'spawn', (_bin, args) => {
    calls++;
    const proc = new EventEmitter();
    proc.stdout = new PassThrough();
    proc.stderr = new PassThrough();
    const expired = args.at(-1).includes('expired');
    process.nextTick(() => {
      proc.stdout.emit(
        'data',
        JSON.stringify({
          url: `https://edge.googlevideo.com/audio?expire=${expired ? 1 : Math.floor(Date.now() / 1000) + 3600}`,
          title: 'Original',
        }),
      );
      proc.emit('close', 0);
    });
    return proc;
  });
  delete require.cache[require.resolve('../src/utils/ytdlp')];
  const { resolveOne } = require('../src/utils/ytdlp');
  const [a, b] = await Promise.all([resolveOne('same song'), resolveOne('same song')]);
  assert.equal(calls, 1);
  a.title = 'Changed';
  assert.equal(b.title, 'Original');
  assert.equal((await resolveOne('same song')).title, 'Original');
  assert.equal(calls, 1);
  await resolveOne('expired');
  await resolveOne('expired');
  assert.equal(calls, 3);
  await resolveOne('same song', { refresh: true });
  assert.equal(calls, 4);
  await resolveOne('same song');
  assert.equal(calls, 4);
});

test('falha do worker usa o processo convencional', async (t) => {
  const previous = process.env.YTDLP_WORKER;
  process.env.YTDLP_WORKER = 'true';
  t.after(() => {
    if (previous === undefined) delete process.env.YTDLP_WORKER;
    else process.env.YTDLP_WORKER = previous;
  });
  const { ResolverWorker } = require('../src/utils/ytdlpWorker');
  t.mock.method(ResolverWorker.prototype, 'resolve', async () => {
    throw new Error('worker offline');
  });
  let calls = 0;
  t.mock.method(child, 'spawn', () => {
    calls++;
    const proc = new EventEmitter();
    proc.stdout = new PassThrough();
    proc.stderr = new PassThrough();
    process.nextTick(() => {
      proc.stdout.emit(
        'data',
        JSON.stringify({ url: 'https://edge.googlevideo.com/audio', title: 'Fallback' }),
      );
      proc.emit('close', 0);
    });
    return proc;
  });
  delete require.cache[require.resolve('../src/utils/ytdlp')];
  const { resolveOne } = require('../src/utils/ytdlp');
  assert.equal((await resolveOne('worker failure')).title, 'Fallback');
  assert.equal(calls, 1);
});

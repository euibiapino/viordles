const { test } = require('node:test');
const assert = require('node:assert/strict');
const https = require('node:https');
const { EventEmitter } = require('node:events');
const { Readable } = require('node:stream');
const { readChunk, handle } = require('../src/utils/streamRelay');

function mockRequests(t, respond) {
  const seen = [];
  t.mock.method(https, 'request', (url, options, callback) => {
    seen.push({ url: String(url), range: options.headers.Range });
    const req = new EventEmitter();
    req.setTimeout = () => {};
    req.end = () => process.nextTick(() => callback(respond(seen.length)));
    return req;
  });
  return seen;
}
function response(status, headers, bytes = []) {
  const stream = Readable.from(bytes);
  stream.statusCode = status;
  stream.headers = headers;
  return stream;
}
const url = 'https://edge.googlevideo.com/videoplayback';

test('segue 302 mantendo o Range e entrega bytes exatos', async (t) => {
  const seen = mockRequests(t, (n) =>
    n === 1
      ? response(302, { location: 'https://other.googlevideo.com/audio' })
      : response(206, { 'content-range': 'bytes 0-3/4' }, [Buffer.from('abcd')]),
  );
  assert.equal((await readChunk(url, 0, 3, 4)).toString(), 'abcd');
  assert.equal(seen[1].range, 'bytes=0-3');
  assert.equal(seen[1].url, 'https://other.googlevideo.com/audio');
});

test('repete corpo interrompido sem devolver bytes parciais', async (t) => {
  mockRequests(t, (n) => {
    if (n > 1) return response(206, { 'content-range': 'bytes 4-7/8' }, [Buffer.from('efgh')]);
    const stream = Readable.from(
      (async function* () {
        yield Buffer.from('ef');
        throw new Error('aborted');
      })(),
    );
    stream.statusCode = 206;
    stream.headers = { 'content-range': 'bytes 4-7/8' };
    return stream;
  });
  assert.equal((await readChunk(url, 4, 7, 8)).toString(), 'efgh');
});

test('recusa resposta truncada, vazia ou com posição errada', async (t) => {
  for (const [range, data] of [
    ['bytes 0-3/4', 'ab'],
    ['bytes 0-3/4', ''],
    ['bytes 1-3/4', 'abc'],
  ]) {
    mockRequests(t, () => response(206, { 'content-range': range }, [Buffer.from(data)]));
    await assert.rejects(readChunk(url, 0, 3, 4));
    t.mock.restoreAll();
  }
});

test('não segue redirecionamento para host fora de googlevideo', async (t) => {
  const seen = mockRequests(t, () => response(302, { location: 'https://example.com/audio' }));
  await assert.rejects(readChunk(url, 0, 3, 4), /destino/);
  assert.ok(seen.every((r) => r.url === url));
});

test('interrompe laço de redirecionamento', async (t) => {
  const seen = mockRequests(t, () => response(302, { location: url }));
  await assert.rejects(readChunk(url, 0, 3, 4), /excessivo/);
  assert.ok(seen.length <= 54);
});

test('Range fora do arquivo retorna 416, sem limitar artificialmente a posição', async () => {
  let status;
  const res = {
    writeHead(code) {
      status = code;
      return this;
    },
    end() {},
  };
  await handle(
    {
      method: 'GET',
      url: '/stream?u=' + encodeURIComponent(url + '?clen=4'),
      headers: { range: 'bytes=4-' },
    },
    res,
  );
  assert.equal(status, 416);
});

test('cache reutiliza blocos completos e não armazena falhas', async () => {
  const { getBlock } = require('../src/utils/streamRelay');
  let calls = 0;
  const reader = async () => {
    calls++;
    return Buffer.from('abcd');
  };
  assert.equal((await getBlock(url + '?cache=test', 0, 4, undefined, reader)).toString(), 'abcd');
  await getBlock(url + '?cache=test', 0, 4, undefined, reader);
  assert.equal(calls, 1);
  await assert.rejects(
    getBlock(url + '?cache=error', 0, 4, undefined, async () => {
      throw new Error('network');
    }),
  );
  assert.equal((await getBlock(url + '?cache=error', 0, 4, undefined, reader)).toString(), 'abcd');
});

test('seek que atravessa blocos mantém bytes e tamanho exatos', async (t) => {
  const total = 300000;
  const source = Buffer.alloc(total);
  for (let i = 0; i < total; i++) source[i] = i % 251;
  const seen = mockRequests(t, (n) => {
    const [start, end] = seen[n - 1].range.slice(6).split('-').map(Number);
    return response(206, { 'content-range': `bytes ${start}-${end}/${total}` }, [
      source.subarray(start, end + 1),
    ]);
  });
  const res = new EventEmitter();
  const chunks = [];
  res.writeHead = (status, headers) => {
    assert.equal(status, 206);
    assert.equal(headers['Content-Length'], 11);
  };
  res.write = (buffer, callback) => {
    chunks.push(buffer);
    callback();
  };
  res.end = () => {};
  await handle(
    {
      method: 'GET',
      url: '/stream?u=' + encodeURIComponent(url + '?clen=' + total),
      headers: { range: 'bytes=262140-262150' },
    },
    res,
  );
  assert.deepEqual(Buffer.concat(chunks), source.subarray(262140, 262151));
});

test('seek atravessa o primeiro bloco de 64 KiB sem perder bytes', async (t) => {
  const total = 300000;
  const source = Buffer.alloc(total);
  for (let i = 0; i < total; i++) source[i] = i % 251;
  const seen = mockRequests(t, (n) => {
    const [start, end] = seen[n - 1].range.slice(6).split('-').map(Number);
    return response(206, { 'content-range': `bytes ${start}-${end}/${total}` }, [
      source.subarray(start, end + 1),
    ]);
  });
  const res = new EventEmitter();
  const chunks = [];
  res.writeHead = (status, headers) => {
    assert.equal(status, 206);
    assert.equal(headers['Content-Length'], 11);
  };
  res.write = (buffer, callback) => {
    chunks.push(buffer);
    callback();
  };
  res.end = () => {};
  await handle(
    {
      method: 'GET',
      url: '/stream?u=' + encodeURIComponent(url + '?clen=' + total),
      headers: { range: 'bytes=65530-65540' },
    },
    res,
  );
  assert.deepEqual(Buffer.concat(chunks), source.subarray(65530, 65541));
});

test('stream completo com primeiro bloco menor preserva todo o áudio', async (t) => {
  const total = 300000;
  const source = Buffer.alloc(total);
  for (let i = 0; i < total; i++) source[i] = i % 251;
  const seen = mockRequests(t, (n) => {
    const [start, end] = seen[n - 1].range.slice(6).split('-').map(Number);
    return response(206, { 'content-range': `bytes ${start}-${end}/${total}` }, [
      source.subarray(start, end + 1),
    ]);
  });
  const res = new EventEmitter();
  const chunks = [];
  res.writeHead = (status, headers) => {
    assert.equal(status, 206);
    assert.equal(headers['Content-Length'], total);
  };
  res.write = (buffer, callback) => {
    chunks.push(buffer);
    callback();
  };
  res.end = () => {};
  await handle(
    {
      method: 'GET',
      url: '/stream?u=' + encodeURIComponent(url + '?full=1&clen=' + total),
      headers: { range: 'bytes=0-299999' },
    },
    res,
  );
  assert.deepEqual(Buffer.concat(chunks), source);
  assert.equal(seen[0].range, 'bytes=0-65535');
});

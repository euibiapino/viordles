const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  matchesMusic,
  normalizeMusicQuery,
  audioErrorMessage,
} = require('../src/utils/musicLookup');
const meta = { title: 'Fuck My Computer', author: 'Ninajirachi', duration: 190577 };
test('aceita título abreviado e duração compatível; rejeita álbum, remix e outro artista', () => {
  assert.ok(matchesMusic({ title: 'Ninajirachi - F*ck My Computer', duration: 192000 }, meta));
  assert.equal(
    matchesMusic(
      { title: 'Ninajirachi - I Love My Computer (Full Album)', duration: 2371000 },
      meta,
    ),
    false,
  );
  assert.equal(
    matchesMusic({ title: 'Ninajirachi - Fuck My Computer', duration: 2371000 }, meta),
    false,
  );
  assert.equal(
    matchesMusic({ title: 'Ninajirachi - Fuck My Computer remix', duration: 192000 }, meta),
    false,
  );
  assert.equal(
    matchesMusic({ title: 'Someone - Fuck My Computer', duration: 192000 }, meta),
    false,
  );
});
test('links de vídeo com lista continuam vídeo e compartilhamentos usam URL canônica', () => {
  for (const query of [
    'https://youtu.be/HWl1Tu9oZmY?list=foo',
    'https://www.youtube.com/watch?v=HWl1Tu9oZmY&list=foo',
    'https://youtube.com/shorts/HWl1Tu9oZmY',
    '<https://youtube.com/watch?v=HWl1Tu9oZmY>',
  ])
    assert.equal(normalizeMusicQuery(query), 'https://www.youtube.com/watch?v=HWl1Tu9oZmY');
  assert.equal(
    normalizeMusicQuery('https://open.spotify.com/intl-pt/track/5ZbztTcvj6QWWbeYsL4GTa?si=test'),
    'https://open.spotify.com/track/5ZbztTcvj6QWWbeYsL4GTa',
  );
  assert.equal(
    normalizeMusicQuery('https://youtube.com/playlist?list=foo'),
    'https://youtube.com/playlist?list=foo',
  );
  assert.match(audioErrorMessage({ code: 'AGE_RESTRICTED' }, 'fallback'), /idade/);
});

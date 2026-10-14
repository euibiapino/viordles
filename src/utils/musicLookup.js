function words(text) {
  return (
    String(text || '')
      .normalize('NFKD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .match(/[\p{L}\p{N}*]+/gu) || []
  );
}

function containsWords(expected, actual) {
  const tokens = words(actual);
  return words(expected).every((word) =>
    tokens.some(
      (token) =>
        token === word ||
        (token.includes('*') &&
          token.replaceAll('*', '').length >= 2 &&
          new RegExp('^' + token.split('*').join('[\\p{L}\\p{N}]*') + '$', 'u').test(word)),
    ),
  );
}

function matchesMusic(candidate, meta) {
  if (!meta.title || !meta.author) return false;
  const haystack = `${candidate.title || ''} ${candidate.author || candidate.uploader || candidate.channel || ''}`;
  if (!containsWords(meta.title.replace(/[([][^)\]]*[)\]]/g, ''), candidate.title)) return false;
  if (!containsWords(meta.author.split(',')[0], haystack)) return false;
  const duration = candidate.duration;
  // Nas buscas do Spotify a duração é necessária para rejeitar álbuns e mixes.
  if (
    meta.duration > 0 &&
    (!(duration > 0) || Math.abs(duration - meta.duration) > Math.max(20000, meta.duration * 0.1))
  )
    return false;
  const versions = ['live', 'remix', 'cover', 'instrumental', 'karaoke', 'slowed', 'sped'];
  return !versions.some(
    (version) => words(candidate.title).includes(version) && !words(meta.title).includes(version),
  );
}

function normalizeMusicQuery(query) {
  const input = query.trim().replace(/^<(.+)>$/, '$1');
  try {
    const url = new URL(input);
    if (!['https:', 'http:'].includes(url.protocol)) return input;
    if (
      ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be'].includes(
        url.hostname,
      )
    ) {
      const id =
        url.hostname === 'youtu.be'
          ? url.pathname.split('/')[1]
          : url.searchParams.get('v') ||
            /^\/(?:shorts|live|embed)\/([^/]+)/.exec(url.pathname)?.[1];
      if (/^[a-zA-Z0-9_-]{11}$/.test(id || '')) return `https://www.youtube.com/watch?v=${id}`;
    }
    if (url.hostname === 'open.spotify.com') {
      const track = /\/(?:intl-[a-z-]+\/|embed\/)?track\/([a-zA-Z0-9]+)(?:\/|$)/.exec(url.pathname);
      if (track) return `https://open.spotify.com/track/${track[1]}`;
    }
  } catch {
    /* Texto livre continua sendo uma busca. */
  }
  return input;
}

function audioErrorMessage(error, fallback) {
  if (error?.code === 'AGE_RESTRICTED')
    return 'Esse vídeo exige login para confirmar a idade no YouTube. Envie outro vídeo da faixa ou o link do Spotify para eu procurar uma versão pública.';
  if (error?.code === 'AUTH_REQUIRED')
    return 'O YouTube exigiu autenticação para esse áudio. Tente outra versão pública da faixa.';
  return fallback;
}
module.exports = { matchesMusic, normalizeMusicQuery, audioErrorMessage };

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getManager } = require('../utils/lavalinkClient');
const {
  buildNowPlayingEmbed,
  buildPlayerButtons,
  buildQueueEmbed,
  formatDuration,
  parseTime,
} = require('../utils/musicHandler');
const { resolveOne, isYoutubePlaylist } = require('../utils/ytdlp');
const spotifyApi = require('../utils/spotify');

function applyMeta(track, meta) {
  Object.assign(track.info, {
    title: meta.title ?? track.info.title,
    author: meta.author ?? track.info.author,
    duration: meta.duration ?? track.info.duration,
    length: meta.duration ?? track.info.duration,
    uri: meta.uri ?? track.info.uri,
    artworkUrl: meta.artworkUrl ?? track.info.artworkUrl,
    sourceName: meta.sourceName ?? track.info.sourceName,
  });
}

function sanitizeForSearch(s) {
  return String(s ?? '')
    .replace(/[([][^)\]]*[)\]]/g, ' ')
    .replace(/\s*-\s*topic$/i, '')
    .replace(/[^\p{L}\p{N}\s'&]/gu, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function spotifyMatches(sp, ytTitle, ytAuthor) {
  const haystack = `${String(ytTitle ?? '')} ${String(ytAuthor ?? '')}`.toLowerCase();
  const firstArtist = String(sp.author ?? '')
    .split(',')[0]
    .trim()
    .toLowerCase();
  const spTitle = String(sp.title ?? '')
    .toLowerCase()
    .replace(/[([][^)\]]*[)\]]/g, '')
    .trim();
  if (!firstArtist || !spTitle) return false;
  return haystack.includes(firstArtist) && haystack.includes(spTitle);
}

function splitArtistTrack(ytTitle) {
  const noParens = String(ytTitle ?? '').replace(/[([][^)\]]*[)\]]/g, '').trim();
  const m = noParens.match(/^(.+?)\s*[-–—]\s*(.+)$/);
  if (!m) return null;
  return { artist: m[1].trim(), track: m[2].trim() };
}

async function enrichWithSpotify(resolved) {
  const cleanedTitle = sanitizeForSearch(resolved.title);
  const cleanedAuthor = sanitizeForSearch(resolved.author);
  const split = splitArtistTrack(resolved.title);

  const queries = [];
  if (split) {
    queries.push(`artist:"${split.artist}" track:"${split.track}"`);
    queries.push(`artist:"${split.track}" track:"${split.artist}"`);
  }
  if (resolved.cleanArtist && resolved.cleanTitle) {
    queries.push(`${resolved.cleanArtist} ${resolved.cleanTitle}`);
  }
  if (resolved.cleanTitle) queries.push(resolved.cleanTitle);
  queries.push(cleanedTitle);
  if (cleanedAuthor && cleanedTitle) queries.push(`${cleanedAuthor} ${cleanedTitle}`);

  const seen = new Set();
  for (const q of queries) {
    if (!q || seen.has(q)) continue;
    seen.add(q);
    const top = await spotifyApi.searchTrack(q).catch(() => null);
    if (top && spotifyMatches(top, resolved.title, resolved.author)) {
      return { ...top, duration: resolved.duration };
    }
  }
  return null;
}

const NEXT_LOOP = { off: 'track', track: 'queue', queue: 'off' };
const LOOP_LABEL = { off: 'Desligado ➡️', track: 'Música 🔂', queue: 'Fila 🔁' };

function err(text) {
  return new EmbedBuilder().setColor(0xed4245).setDescription(text);
}

function ok(text) {
  return new EmbedBuilder().setColor(0x57f287).setDescription(text);
}

async function getOrCreatePlayer(interaction) {
  const member = interaction.guild.members.cache.get(interaction.user.id);
  const voiceChannel = member?.voice?.channel;
  if (!voiceChannel) return { error: 'Você precisa estar em um canal de voz!' };

  const manager = getManager();
  if (!manager) return { error: 'Player de música não está pronto ainda.' };

  let player = manager.getPlayer(interaction.guildId);
  if (!player) {
    player = await manager.createPlayer({
      guildId: interaction.guildId,
      voiceChannelId: voiceChannel.id,
      textChannelId: interaction.channelId,
      selfDeaf: false,
      volume: 100,
      node: 'main',
    });
    await player.connect();
  } else if (player.voiceChannelId !== voiceChannel.id) {
    return { error: 'Você precisa estar no mesmo canal de voz que o bot!' };
  }

  return { player };
}

function requirePlayer(interaction) {
  const manager = getManager();
  const player = manager?.getPlayer(interaction.guildId);
  if (!player || !player.queue.current) return null;
  return player;
}

// ─── Subcommand handlers ─────────────────────────────────────────────────────

async function loadHttpTrack(player, streamUrl, requester, meta) {
  const res = await player.search({ query: streamUrl }, requester).catch(() => null);
  if (!res || !res.tracks?.[0]) return null;
  const track = res.tracks[0];
  applyMeta(track, meta);
  return track;
}

async function cmdTocar(interaction) {
  const query = interaction.options.getString('query');
  await interaction.deferReply();

  const { player, error } = await getOrCreatePlayer(interaction);
  if (error) return interaction.editReply({ embeds: [err(error)] });

  if (!player.playing && !player.paused && !player.queue.current) {
    await player.setRepeatMode('off');
  }

  const isUrl = /^https?:\/\//.test(query);
  const isSpotify = /open\.spotify\.com\/(intl-[a-z]+\/)?(track|album|playlist)\//.test(query);
  const isPlaylist = isUrl && (isYoutubePlaylist(query) || /\/(album|playlist)\//.test(query));

  if (isPlaylist) {
    return interaction.editReply({
      embeds: [err('Playlists ainda não suportadas — me passe uma música individual.')],
    });
  }

  if (isSpotify) {
    const meta = await player.search({ query }, interaction.user).catch(() => null);
    if (!meta || meta.loadType === 'empty' || meta.loadType === 'error' || !meta.tracks?.[0]) {
      return interaction.editReply({ embeds: [err(`Não achei essa música no Spotify.`)] });
    }
    const sp = meta.tracks[0];
    const resolved = await resolveOne(`${sp.info.author} ${sp.info.title}`).catch(() => null);
    if (!resolved)
      return interaction.editReply({ embeds: [err(`Não achei áudio para **${sp.info.title}**`)] });

    const track = await loadHttpTrack(player, resolved.streamUrl, interaction.user, {
      title: sp.info.title,
      author: sp.info.author,
      duration: sp.info.duration,
      uri: sp.info.uri,
      artworkUrl: sp.info.artworkUrl ?? resolved.thumbnail,
      sourceName: 'spotify',
    });
    if (!track)
      return interaction.editReply({ embeds: [err(`Falha ao carregar **${sp.info.title}**`)] });

    await player.queue.add(track);
    if (!player.playing && !player.paused) await player.play();
    return interaction.editReply({ embeds: [buildAddedEmbed(track, player)] });
  }

  const resolved = await resolveOne(query).catch(() => null);
  if (!resolved)
    return interaction.editReply({ embeds: [err(`Nada encontrado para **${query}**`)] });

  const [spotifyMeta, lavaSearch] = await Promise.all([
    enrichWithSpotify(resolved).catch(() => null),
    player.search({ query: resolved.streamUrl }, interaction.user).catch(() => null),
  ]);
  const meta = spotifyMeta ?? {
    title: resolved.title,
    author: resolved.author,
    duration: resolved.duration,
    uri: resolved.sourceUrl,
    artworkUrl: resolved.thumbnail,
    sourceName: resolved.sourceName,
  };

  const track = lavaSearch?.tracks?.[0];
  if (!track)
    return interaction.editReply({ embeds: [err(`Falha ao carregar **${meta.title}**`)] });
  applyMeta(track, meta);

  await player.queue.add(track);
  if (!player.playing && !player.paused) await player.play();
  return interaction.editReply({ embeds: [buildAddedEmbed(track, player)] });
}

function buildAddedEmbed(t, player) {
  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle('✅ Adicionado à fila!')
    .setDescription(`[${t.info.title}](${t.info.uri})`)
    .addFields(
      { name: '🎙️ Artista', value: t.info.author || '—', inline: true },
      { name: '⏱️ Duração', value: formatDuration(t.info.duration), inline: true },
      { name: '📋 Posição', value: `#${player.queue.tracks.length}`, inline: true },
    );
  if (t.info.artworkUrl) embed.setThumbnail(t.info.artworkUrl);
  return embed;
}

async function cmdPular(interaction) {
  const player = requirePlayer(interaction);
  if (!player) return interaction.reply({ embeds: [err('Nada tocando agora.')], flags: 64 });

  const title = player.queue.current.info.title;
  await player.skip();
  return interaction.reply({ embeds: [ok(`⏭ **${title}** pulada!`)] });
}

async function cmdAnterior(interaction) {
  const manager = getManager();
  const player = manager?.getPlayer(interaction.guildId);
  if (!player) return interaction.reply({ embeds: [err('Nada tocando agora.')], flags: 64 });

  const prev = player.queue.previous?.[0];
  if (!prev) return interaction.reply({ embeds: [err('Sem música anterior.')], flags: 64 });

  await player.queue.add([prev], 0);
  await player.skip();
  return interaction.reply({ embeds: [ok(`⏮ Voltando para **${prev.info.title}**`)] });
}

async function cmdPausar(interaction) {
  const player = requirePlayer(interaction);
  if (!player) return interaction.reply({ embeds: [err('Nada tocando agora.')], flags: 64 });
  if (player.paused) return interaction.reply({ embeds: [err('Já está pausado.')], flags: 64 });

  await player.pause();
  return interaction.reply({ embeds: [ok('⏸️ Pausado.')] });
}

async function cmdRetomar(interaction) {
  const manager = getManager();
  const player = manager?.getPlayer(interaction.guildId);
  if (!player || !player.paused)
    return interaction.reply({ embeds: [err('Não está pausado.')], flags: 64 });

  await player.resume();
  return interaction.reply({ embeds: [ok('▶️ Retomado.')] });
}

async function cmdParar(interaction) {
  const manager = getManager();
  const player = manager?.getPlayer(interaction.guildId);
  if (!player) return interaction.reply({ embeds: [err('Nada tocando agora.')], flags: 64 });

  await player.stopPlaying(true, false);
  await player.destroy();
  return interaction.reply({ embeds: [ok('⏹️ Player parado e fila limpa.')] });
}

async function cmdFila(interaction) {
  const manager = getManager();
  const player = manager?.getPlayer(interaction.guildId);
  if (!player || !player.queue.current)
    return interaction.reply({ embeds: [err('Nada tocando agora.')], flags: 64 });

  const page = interaction.options.getInteger('pagina') || 1;
  return interaction.reply({ embeds: [buildQueueEmbed(player, page)] });
}

async function cmdTocando(interaction) {
  const manager = getManager();
  const player = manager?.getPlayer(interaction.guildId);
  if (!player || !player.queue.current) {
    return interaction.reply({ embeds: [buildNowPlayingEmbed(null)] });
  }

  const components = buildPlayerButtons(player);
  const msg = await interaction.reply({
    embeds: [buildNowPlayingEmbed(player)],
    components,
    fetchReply: true,
  });
  const { controllers } = require('../utils/musicHandler');
  controllers.set(interaction.guildId, msg);
}

async function cmdVolume(interaction) {
  const player = requirePlayer(interaction);
  if (!player) return interaction.reply({ embeds: [err('Nada tocando agora.')], flags: 64 });

  const vol = interaction.options.getInteger('nivel');
  await player.setVolume(vol);
  return interaction.reply({ embeds: [ok(`🔊 Volume definido para **${vol}%**`)] });
}

async function cmdRepetir(interaction) {
  const player = requirePlayer(interaction);
  if (!player) return interaction.reply({ embeds: [err('Nada tocando agora.')], flags: 64 });

  const mode = interaction.options.getString('modo');
  await player.setRepeatMode(mode);

  const { controllers } = require('../utils/musicHandler');
  const msg = controllers.get(interaction.guildId);
  if (msg) {
    await msg
      .edit({
        embeds: [buildNowPlayingEmbed(player)],
        components: buildPlayerButtons(player),
      })
      .catch(() => {});
  }

  return interaction.reply({ embeds: [ok(`🔁 Modo de repetição: **${LOOP_LABEL[mode]}**`)] });
}

async function cmdShuffle(interaction) {
  const player = requirePlayer(interaction);
  if (!player) return interaction.reply({ embeds: [err('Nada tocando agora.')], flags: 64 });
  if (!player.queue.tracks?.length)
    return interaction.reply({ embeds: [err('A fila está vazia.')], flags: 64 });

  await player.queue.shuffle();
  return interaction.reply({
    embeds: [ok(`🔀 Fila embaralhada! (${player.queue.tracks.length} músicas)`)],
  });
}

async function cmdRemover(interaction) {
  const player = requirePlayer(interaction);
  if (!player) return interaction.reply({ embeds: [err('Nada tocando agora.')], flags: 64 });

  const pos = interaction.options.getInteger('posicao') - 1;
  const tracks = player.queue.tracks;
  if (pos < 0 || pos >= tracks.length) {
    return interaction.reply({
      embeds: [err(`Posição inválida. A fila tem **${tracks.length}** músicas.`)],
      flags: 64,
    });
  }

  const removed = tracks[pos];
  await player.queue.splice(pos, 1);
  return interaction.reply({ embeds: [ok(`🗑️ **${removed.info.title}** removida da fila.`)] });
}

async function cmdMover(interaction) {
  const player = requirePlayer(interaction);
  if (!player) return interaction.reply({ embeds: [err('Nada tocando agora.')], flags: 64 });

  const from = interaction.options.getInteger('de') - 1;
  const to = interaction.options.getInteger('para') - 1;
  const tracks = player.queue.tracks;

  if (from < 0 || from >= tracks.length || to < 0 || to >= tracks.length) {
    return interaction.reply({
      embeds: [err(`Posição inválida. A fila tem **${tracks.length}** músicas.`)],
      flags: 64,
    });
  }

  const [track] = await player.queue.splice(from, 1);
  await player.queue.splice(to, 0, track);
  return interaction.reply({
    embeds: [ok(`↕️ **${track.info.title}** movida para posição **${to + 1}**.`)],
  });
}

async function cmdPularPara(interaction) {
  const player = requirePlayer(interaction);
  if (!player) return interaction.reply({ embeds: [err('Nada tocando agora.')], flags: 64 });

  const pos = interaction.options.getInteger('posicao') - 1;
  const tracks = player.queue.tracks;
  if (pos < 0 || pos >= tracks.length) {
    return interaction.reply({
      embeds: [err(`Posição inválida. A fila tem **${tracks.length}** músicas.`)],
      flags: 64,
    });
  }

  if (pos > 0) await player.queue.splice(0, pos);
  await player.skip();
  return interaction.reply({ embeds: [ok(`⏩ Pulando para posição **${pos + 1}**.`)] });
}

async function cmdSeek(interaction) {
  const player = requirePlayer(interaction);
  if (!player) return interaction.reply({ embeds: [err('Nada tocando agora.')], flags: 64 });

  const input = interaction.options.getString('tempo');
  const ms = parseTime(input);
  if (ms === null)
    return interaction.reply({
      embeds: [err('Formato inválido. Use `1:30` ou `90` (segundos).')],
      flags: 64,
    });

  const dur = player.queue.current.info.duration;
  if (ms > dur)
    return interaction.reply({
      embeds: [err(`Tempo maior que a duração da música (\`${formatDuration(dur)}\`).`)],
      flags: 64,
    });

  await player.seek(ms);
  return interaction.reply({ embeds: [ok(`⏩ Indo para \`${formatDuration(ms)}\``)] });
}

async function cmdAvancar(interaction) {
  const player = requirePlayer(interaction);
  if (!player) return interaction.reply({ embeds: [err('Nada tocando agora.')], flags: 64 });

  const secs = (interaction.options.getInteger('segundos') || 10) * 1000;
  const newPos = Math.min(player.position + secs, player.queue.current.info.duration - 1000);
  await player.seek(newPos);
  return interaction.reply({
    embeds: [ok(`⏩ Avançou **${secs / 1000}s** → \`${formatDuration(newPos)}\``)],
  });
}

async function cmdRetroceder(interaction) {
  const player = requirePlayer(interaction);
  if (!player) return interaction.reply({ embeds: [err('Nada tocando agora.')], flags: 64 });

  const secs = (interaction.options.getInteger('segundos') || 10) * 1000;
  const newPos = Math.max(player.position - secs, 0);
  await player.seek(newPos);
  return interaction.reply({
    embeds: [ok(`⏪ Retrocedeu **${secs / 1000}s** → \`${formatDuration(newPos)}\``)],
  });
}

async function cmdLetras(interaction) {
  const player = requirePlayer(interaction);
  if (!player) return interaction.reply({ embeds: [err('Nada tocando agora.')], flags: 64 });

  await interaction.deferReply();
  const track = player.queue.current;

  try {
    const lyrics = await player.getCurrentLyrics(true);
    if (!lyrics || !lyrics.text) throw new Error('not found');

    const text = lyrics.text.substring(0, 4000);
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`📝 ${track.info.title}`)
      .setDescription(text)
      .setFooter({ text: lyrics.provider ? `Fonte: ${lyrics.provider}` : '' });
    return interaction.editReply({ embeds: [embed] });
  } catch {
    const query = `${track.info.author} ${track.info.title}`;
    return interaction.editReply({
      embeds: [
        err(
          `Não encontrei letra para **${track.info.title}**.\nTente buscar manualmente: [Genius](https://genius.com/search?q=${encodeURIComponent(query)})`,
        ),
      ],
    });
  }
}

async function cmdEfeito(interaction) {
  const player = requirePlayer(interaction);
  if (!player) return interaction.reply({ embeds: [err('Nada tocando agora.')], flags: 64 });

  const tipo = interaction.options.getString('tipo');
  await applyEffect(player, tipo);

  const labels = {
    nightcore: 'Nightcore 🌙',
    vaporwave: 'Vaporwave 🌊',
    '8d': '8D Audio 🎧',
    bassboost: 'Bassboost 🔊',
    karaoke: 'Karaoke 🎤',
    reset: 'Resetado 🔄',
  };
  return interaction.reply({ embeds: [ok(`🎛️ Efeito **${labels[tipo] ?? tipo}** aplicado!`)] });
}

async function cmd247(interaction) {
  const manager = getManager();
  const player = manager?.getPlayer(interaction.guildId);
  if (!player) return interaction.reply({ embeds: [err('Nada tocando agora.')], flags: 64 });

  const current = player.getData('247') || false;
  player.setData('247', !current);
  return interaction.reply({
    embeds: [ok(`🔁 Modo 24/7 **${!current ? 'ativado' : 'desativado'}**!`)],
  });
}

async function cmdLimpar(interaction) {
  const player = requirePlayer(interaction);
  if (!player) return interaction.reply({ embeds: [err('Nada tocando agora.')], flags: 64 });

  const count = player.queue.tracks.length;
  await player.queue.splice(0, count);
  return interaction.reply({ embeds: [ok(`🗑️ **${count}** músicas removidas da fila.`)] });
}

// ─── Effects helper ───────────────────────────────────────────────────────────

async function applyEffect(player, tipo) {
  const fm = player.filterManager;
  switch (tipo) {
    case 'nightcore':
      await fm.toggleNightcore();
      break;
    case 'vaporwave':
      await fm.toggleVaporwave();
      break;
    case '8d':
      await fm.toggleRotation(0.2);
      break;
    case 'karaoke':
      await fm.toggleKaraoke();
      break;
    case 'bassboost': {
      const active = player.getData('bassboost');
      if (active) {
        await fm.clearEQ();
        player.setData('bassboost', false);
      } else {
        await fm.setEQPreset('boost');
        player.setData('bassboost', true);
      }
      break;
    }
    case 'reset':
      await fm.resetFilters();
      player.setData('bassboost', false);
      break;
  }
}

// ─── Button & select handlers ─────────────────────────────────────────────────

async function handleButton(interaction) {
  const manager = getManager();
  const player = manager?.getPlayer(interaction.guildId);

  if (!player) {
    return interaction.reply({ embeds: [err('Nada tocando agora.')], flags: 64 });
  }

  const id = interaction.customId;
  await interaction.deferUpdate();

  switch (id) {
    case 'music_pause':
      if (player.paused) await player.resume();
      else await player.pause();
      break;
    case 'music_skip':
      await player.skip();
      break;
    case 'music_previous': {
      const prev = player.queue.previous?.[0];
      if (prev) {
        await player.queue.add([prev], 0);
        await player.skip();
      }
      break;
    }
    case 'music_stop':
      await player.stopPlaying(true, false);
      await player.destroy();
      return;
    case 'music_shuffle':
      if (player.queue.tracks?.length) await player.queue.shuffle();
      break;
    case 'music_loop': {
      const next = NEXT_LOOP[player.repeatMode] ?? 'off';
      await player.setRepeatMode(next);
      break;
    }
    case 'music_vol_up':
      await player.setVolume(Math.min(player.volume + 20, 200));
      break;
    case 'music_vol_down':
      await player.setVolume(Math.max(player.volume - 20, 0));
      break;
    case 'music_forward': {
      const np = Math.min(
        player.position + 10_000,
        (player.queue.current?.info.duration ?? 0) - 1000,
      );
      await player.seek(np);
      break;
    }
    case 'music_rewind': {
      const np = Math.max(player.position - 10_000, 0);
      await player.seek(np);
      break;
    }
  }

  if (player.queue.current) {
    const { controllers } = require('../utils/musicHandler');
    const msg = controllers.get(interaction.guildId);
    if (msg) {
      await msg
        .edit({
          embeds: [buildNowPlayingEmbed(player)],
          components: buildPlayerButtons(player),
        })
        .catch(() => {});
    }
  }
}

async function handleSelect(interaction) {
  const manager = getManager();
  const player = manager?.getPlayer(interaction.guildId);

  if (!player) return interaction.reply({ embeds: [err('Nada tocando agora.')], flags: 64 });

  const value = interaction.values[0];
  await interaction.deferUpdate();

  if (interaction.customId === 'music_tracks_select') {
    const idx = parseInt(value.replace('music_track_', ''), 10);
    if (idx > 0) await player.queue.splice(0, idx);
    await player.skip();
  }

  if (interaction.customId === 'music_effects_select') {
    const tipo = value.replace('effect_', '');
    await applyEffect(player, tipo);
  }

  if (player.queue.current) {
    const { controllers } = require('../utils/musicHandler');
    const msg = controllers.get(interaction.guildId);
    if (msg) {
      await msg
        .edit({
          embeds: [buildNowPlayingEmbed(player)],
          components: buildPlayerButtons(player),
        })
        .catch(() => {});
    }
  }
}

// ─── Command definition ───────────────────────────────────────────────────────

const data = new SlashCommandBuilder()
  .setName('musica')
  .setDescription('Player de música')
  .addSubcommand((s) =>
    s
      .setName('tocar')
      .setDescription('Toca uma música ou playlist')
      .addStringOption((o) =>
        o.setName('query').setDescription('Nome, URL do YouTube ou Spotify').setRequired(true),
      ),
  )
  .addSubcommand((s) => s.setName('pular').setDescription('Pula a música atual'))
  .addSubcommand((s) => s.setName('anterior').setDescription('Volta para a música anterior'))
  .addSubcommand((s) => s.setName('pausar').setDescription('Pausa a reprodução'))
  .addSubcommand((s) => s.setName('retomar').setDescription('Retoma a reprodução'))
  .addSubcommand((s) => s.setName('parar').setDescription('Para o player e limpa a fila'))
  .addSubcommand((s) =>
    s
      .setName('fila')
      .setDescription('Mostra a fila de músicas')
      .addIntegerOption((o) =>
        o.setName('pagina').setDescription('Número da página').setMinValue(1),
      ),
  )
  .addSubcommand((s) => s.setName('tocando').setDescription('Mostra o painel do player'))
  .addSubcommand((s) =>
    s
      .setName('volume')
      .setDescription('Ajusta o volume')
      .addIntegerOption((o) =>
        o
          .setName('nivel')
          .setDescription('Volume de 0 a 200')
          .setRequired(true)
          .setMinValue(0)
          .setMaxValue(200),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName('repetir')
      .setDescription('Define o modo de repetição')
      .addStringOption((o) =>
        o
          .setName('modo')
          .setDescription('Modo de repetição')
          .setRequired(true)
          .addChoices(
            { name: 'Desligado', value: 'off' },
            { name: 'Música atual', value: 'track' },
            { name: 'Fila inteira', value: 'queue' },
          ),
      ),
  )
  .addSubcommand((s) => s.setName('shuffle').setDescription('Embaralha a fila'))
  .addSubcommand((s) =>
    s
      .setName('remover')
      .setDescription('Remove uma música da fila')
      .addIntegerOption((o) =>
        o.setName('posicao').setDescription('Posição na fila').setRequired(true).setMinValue(1),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName('mover')
      .setDescription('Move uma música na fila')
      .addIntegerOption((o) =>
        o.setName('de').setDescription('Posição atual').setRequired(true).setMinValue(1),
      )
      .addIntegerOption((o) =>
        o.setName('para').setDescription('Nova posição').setRequired(true).setMinValue(1),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName('pular-para')
      .setDescription('Pula para uma posição específica na fila')
      .addIntegerOption((o) =>
        o.setName('posicao').setDescription('Posição na fila').setRequired(true).setMinValue(1),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName('seek')
      .setDescription('Vai para um tempo específico da música')
      .addStringOption((o) =>
        o.setName('tempo').setDescription('Tempo (ex: 1:30 ou 90)').setRequired(true),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName('avancar')
      .setDescription('Avança X segundos')
      .addIntegerOption((o) =>
        o
          .setName('segundos')
          .setDescription('Segundos para avançar (padrão: 10)')
          .setMinValue(1)
          .setMaxValue(300),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName('retroceder')
      .setDescription('Retrocede X segundos')
      .addIntegerOption((o) =>
        o
          .setName('segundos')
          .setDescription('Segundos para retroceder (padrão: 10)')
          .setMinValue(1)
          .setMaxValue(300),
      ),
  )
  .addSubcommand((s) => s.setName('letras').setDescription('Mostra a letra da música atual'))
  .addSubcommand((s) =>
    s
      .setName('efeito')
      .setDescription('Aplica um efeito de áudio')
      .addStringOption((o) =>
        o
          .setName('tipo')
          .setDescription('Efeito')
          .setRequired(true)
          .addChoices(
            { name: '🌙 Nightcore', value: 'nightcore' },
            { name: '🌊 Vaporwave', value: 'vaporwave' },
            { name: '🎧 8D Audio', value: '8d' },
            { name: '🔊 Bassboost', value: 'bassboost' },
            { name: '🎤 Karaoke', value: 'karaoke' },
            { name: '🔄 Resetar', value: 'reset' },
          ),
      ),
  )
  .addSubcommand((s) =>
    s.setName('247').setDescription('Liga/desliga o modo 24/7 (bot fica no canal)'),
  )
  .addSubcommand((s) => s.setName('limpar').setDescription('Limpa a fila de músicas'));

const HANDLERS = {
  tocar: cmdTocar,
  pular: cmdPular,
  anterior: cmdAnterior,
  pausar: cmdPausar,
  retomar: cmdRetomar,
  parar: cmdParar,
  fila: cmdFila,
  tocando: cmdTocando,
  volume: cmdVolume,
  repetir: cmdRepetir,
  shuffle: cmdShuffle,
  remover: cmdRemover,
  mover: cmdMover,
  'pular-para': cmdPularPara,
  seek: cmdSeek,
  avancar: cmdAvancar,
  retroceder: cmdRetroceder,
  letras: cmdLetras,
  efeito: cmdEfeito,
  247: cmd247,
  limpar: cmdLimpar,
};

async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  const handler = HANDLERS[sub];
  if (handler) await handler(interaction);
}

module.exports = { data, execute, handleButton, handleSelect };

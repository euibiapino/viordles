const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} = require('discord.js');

const controllers = new Map();
let botIconURL = null;

function setBotIcon(url) {
  botIconURL = url;
}

const SOURCE_COLOR = {
  youtube: 0xff0000,
  spotify: 0x1db954,
  soundcloud: 0xff5500,
  bandcamp: 0x1da0c3,
  default: 0x5865f2,
};

function formatDuration(ms) {
  if (!ms || ms === 0) return '∞';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function repeatLabel(mode) {
  return { track: 'Música', queue: 'Fila', off: 'Desligado' }[mode] ?? 'Desligado';
}

function repeatEmoji(mode) {
  return { track: '🔂', queue: '🔁', off: '➡️' }[mode] ?? '➡️';
}

function buildNowPlayingEmbed(player) {
  const track = player?.queue?.current;
  if (!track) {
    return new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('Nada tocando agora')
      .setDescription('Use `/musica tocar` para começar!');
  }

  const source = track.info.sourceName || 'default';
  const pos = player.position || 0;
  const dur = track.info.duration || 0;
  const upcoming = player.queue.tracks?.length || 0;
  const times = `\`${formatDuration(pos)} / ${formatDuration(dur)}\``;

  const embed = new EmbedBuilder()
    .setColor(SOURCE_COLOR[source] ?? SOURCE_COLOR.default)
    .setAuthor({ name: 'Tocando Agora', iconURL: botIconURL ?? undefined })
    .setTitle(track.info.title.substring(0, 256))
    .setURL(track.info.uri)
    .setDescription(times)
    .addFields(
      { name: '🎙️ Artista', value: track.info.author || '—', inline: true },
      { name: '🔊 Volume', value: `${player.volume}%`, inline: true },
      { name: '🔁 Repetir', value: repeatLabel(player.repeatMode), inline: true },
      {
        name: '📋 Fila',
        value: upcoming > 0 ? `${upcoming} música${upcoming !== 1 ? 's' : ''}` : 'Vazia',
        inline: true,
      },
      { name: '📡 Canal', value: `<#${player.voiceChannelId}>`, inline: true },
    )
    .setFooter({
      text: `Pedido por ${track.requester?.username ?? 'Desconhecido'}`,
      iconURL: track.requester?.displayAvatarURL?.() ?? undefined,
    })
    .setTimestamp();

  if (track.info.artworkUrl) embed.setThumbnail(track.info.artworkUrl);

  return embed;
}

function buildPlayerButtons(player) {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('music_previous')
      .setEmoji('⏮')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_rewind').setEmoji('⏪').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('music_pause')
      .setEmoji(player.paused ? '▶️' : '⏸️')
      .setStyle(player.paused ? ButtonStyle.Success : ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('music_forward').setEmoji('⏩').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_skip').setEmoji('⏭').setStyle(ButtonStyle.Secondary),
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('music_vol_down')
      .setEmoji('🔉')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('music_loop')
      .setEmoji(repeatEmoji(player.repeatMode))
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_stop').setEmoji('⏹️').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('music_shuffle').setEmoji('🔀').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_vol_up').setEmoji('🔊').setStyle(ButtonStyle.Secondary),
  );

  const rows = [row1, row2];

  const upcoming = player.queue.tracks || [];
  if (upcoming.length > 0) {
    const options = upcoming.slice(0, 10).map((t, i) => ({
      label: `${i + 1}. ${t.info.title}`.substring(0, 100),
      value: `music_track_${i}`,
      description: (t.info.author || '').substring(0, 50) || undefined,
    }));
    rows.push(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('music_tracks_select')
          .setPlaceholder('🎵 Pular para...')
          .addOptions(options),
      ),
    );
  }

  return rows;
}

async function updateController(player, channel) {
  const embed = buildNowPlayingEmbed(player);
  const components = player.queue.current ? buildPlayerButtons(player) : [];

  const existing = controllers.get(player.guildId);
  if (existing) {
    try {
      await existing.edit({ embeds: [embed], components });
      return;
    } catch {
      controllers.delete(player.guildId);
    }
  }

  const msg = await channel.send({ embeds: [embed], components });
  controllers.set(player.guildId, msg);
}

async function clearController(guildId) {
  const msg = controllers.get(guildId);
  if (msg) {
    try {
      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('Nada tocando agora')
        .setDescription('Use `/musica tocar` para começar!');
      await msg.edit({ embeds: [embed], components: [] });
    } catch {
      // mensagem ja deletada ou sem permissao
    }
    controllers.delete(guildId);
  }
}

function buildQueueEmbed(player, page = 1) {
  const current = player.queue.current;
  const tracks = player.queue.tracks || [];

  const PAGE_SIZE = 10;
  const totalPages = Math.max(Math.ceil(tracks.length / PAGE_SIZE), 1);
  const p = Math.min(Math.max(page, 1), totalPages);

  let desc = '';
  if (current) {
    desc += `**▶ Tocando agora:**\n[${current.info.title}](${current.info.uri}) — \`${formatDuration(current.info.duration)}\`\n\n`;
  }

  if (tracks.length > 0) {
    desc += '**📋 Próximas:**\n';
    const slice = tracks.slice((p - 1) * PAGE_SIZE, p * PAGE_SIZE);
    desc += slice
      .map(
        (t, i) =>
          `**${(p - 1) * PAGE_SIZE + i + 1}.** [${t.info.title}](${t.info.uri}) — \`${formatDuration(t.info.duration)}\` • *${t.requester?.username ?? '?'}*`,
      )
      .join('\n');
  } else if (!current) {
    desc = 'A fila está vazia!';
  }

  const totalDuration = tracks.reduce((acc, t) => acc + (t.info.duration || 0), 0);

  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('📋 Fila de Músicas')
    .setDescription(desc.substring(0, 4096))
    .setFooter({
      text: `Página ${p}/${totalPages} • ${tracks.length} música${tracks.length !== 1 ? 's' : ''} • ${formatDuration(totalDuration)} restantes • Volume: ${player.volume}%`,
    });
}

function parseTime(input) {
  const parts = String(input).split(':').map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 1) return parts[0] * 1000;
  if (parts.length === 2) return (parts[0] * 60 + parts[1]) * 1000;
  if (parts.length === 3) return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
  return null;
}

module.exports = {
  controllers,
  setBotIcon,
  formatDuration,
  parseTime,
  buildNowPlayingEmbed,
  buildPlayerButtons,
  buildQueueEmbed,
  updateController,
  clearController,
};

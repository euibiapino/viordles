const {
  SlashCommandBuilder,
  EmbedBuilder,
  ChannelType,
  PermissionFlagsBits,
} = require('discord.js');
const {
  DEFAULT_MESSAGE,
  DEFAULT_GOODBYE,
  DEFAULT_NEW_ACCOUNT_DAYS,
  getConfig,
  setConfig,
  buildWelcomePayload,
  buildGoodbyeEmbed,
  missingPermissions,
  resolveChannel,
} = require('../utils/welcomeHandler');

const { loadWelcomeImage } = require('../utils/welcomeImage');

const MAX_IMAGENS = 20;

function err(text) {
  return new EmbedBuilder().setColor(0xed4245).setDescription(text);
}

function ok(text) {
  return new EmbedBuilder().setColor(0x57f287).setDescription(text);
}

function reply(interaction, embed) {
  return interaction.reply({ embeds: [embed], flags: 64 });
}

async function exigeCanalPostavel(interaction, canal) {
  const faltando = missingPermissions(canal, interaction.guild.members.me);
  if (!faltando.length) return null;
  return err(`Não consigo postar em ${canal}. Faltam permissões: **${faltando.join(', ')}**`);
}

async function cmdCanal(interaction) {
  const canal = interaction.options.getChannel('canal');
  const problema = await exigeCanalPostavel(interaction, canal);
  if (problema) return reply(interaction, problema);

  await setConfig(interaction.guildId, { channel_id: canal.id, enabled: true });
  return reply(
    interaction,
    ok(`Boas-vindas ativadas em ${canal}. Use \`/boasvindas testar\` para ver como ficou.`),
  );
}

async function cmdMensagem(interaction) {
  await setConfig(interaction.guildId, { message: interaction.options.getString('texto') });
  return reply(interaction, ok('Mensagem atualizada.'));
}

async function cmdAtivar(interaction, enabled) {
  const cfg = await getConfig(interaction.guildId);
  if (enabled && !cfg?.channel_id) {
    return reply(interaction, err('Defina o canal primeiro com `/boasvindas canal`.'));
  }
  await setConfig(interaction.guildId, { enabled });
  return reply(interaction, ok(enabled ? 'Boas-vindas ativadas.' : 'Boas-vindas desativadas.'));
}

async function cmdContaNova(interaction) {
  const dias = interaction.options.getInteger('dias');
  await setConfig(interaction.guildId, { new_account_days: dias });
  return reply(
    interaction,
    ok(
      dias > 0
        ? `Contas criadas há menos de **${dias} dia(s)** vão ser marcadas no embed.`
        : 'Aviso de conta recente desativado.',
    ),
  );
}

// Copiar a URL da aba em vez do endereço da imagem é o erro mais fácil de
// cometer aqui, e o sintoma só aparece quando alguém entra no servidor. Vale
// bater no link na hora do cadastro para falhar com explicação.
async function checkImageUrl(url) {
  try {
    await loadWelcomeImage(url);
    return null;
  } catch (error) {
    return error.message;
  }
}

async function cmdImagemAdicionar(interaction) {
  const url = interaction.options.getString('url');
  if (!/^https:\/\/\S+$/.test(url)) {
    return reply(interaction, err('A URL precisa começar com `https://`.'));
  }

  const cfg = await getConfig(interaction.guildId);
  const images = cfg?.images ?? [];
  if (images.length >= MAX_IMAGENS) {
    return reply(interaction, err(`Limite de ${MAX_IMAGENS} imagens atingido.`));
  }
  if (images.includes(url)) return reply(interaction, err('Essa imagem já está na lista.'));

  // A verificação vai à rede, então não cabe nos 3s de resposta direta.
  await interaction.deferReply({ flags: 64 });

  const problema = await checkImageUrl(url);
  if (problema) {
    return interaction.editReply({
      embeds: [
        err(
          `Não consegui usar esse link: ${problema}.\n\n` +
            'Use o **endereço direto da imagem**: clique com o botão direito sobre ela e ' +
            'escolha *Copiar endereço da imagem*. Costuma terminar em `.gif`, `.png` ou `.jpg`.',
        ),
      ],
    });
  }

  await setConfig(interaction.guildId, { images: [...images, url] });
  return interaction.editReply({
    embeds: [
      ok(`Imagem adicionada (${images.length + 1} no total). Uma é sorteada a cada entrada.`),
    ],
  });
}

async function cmdImagemRemover(interaction) {
  const indice = interaction.options.getInteger('indice');
  const cfg = await getConfig(interaction.guildId);
  const images = cfg?.images ?? [];

  if (indice < 1 || indice > images.length) {
    return reply(interaction, err(`Índice inválido. A lista tem ${images.length} imagem(ns).`));
  }

  const restantes = images.filter((_, i) => i !== indice - 1);
  await setConfig(interaction.guildId, { images: restantes });
  return reply(interaction, ok(`Imagem #${indice} removida.`));
}

async function cmdImagemListar(interaction) {
  const cfg = await getConfig(interaction.guildId);
  const images = cfg?.images ?? [];
  if (!images.length) {
    return reply(
      interaction,
      err('Nenhuma imagem cadastrada. Use `/boasvindas imagem adicionar`.'),
    );
  }
  return reply(
    interaction,
    new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`Imagens de boas-vindas (${images.length})`)
      .setDescription(images.map((u, i) => `**${i + 1}.** ${u}`).join('\n'))
      .setFooter({ text: 'Uma é sorteada a cada entrada.' }),
  );
}

async function cmdSaidaCanal(interaction) {
  const canal = interaction.options.getChannel('canal');
  const problema = await exigeCanalPostavel(interaction, canal);
  if (problema) return reply(interaction, problema);

  await setConfig(interaction.guildId, { goodbye_channel_id: canal.id, goodbye_enabled: true });
  return reply(interaction, ok(`Mensagens de saída ativadas em ${canal}.`));
}

async function cmdSaidaMensagem(interaction) {
  await setConfig(interaction.guildId, { goodbye_message: interaction.options.getString('texto') });
  return reply(interaction, ok('Mensagem de saída atualizada.'));
}

async function cmdSaidaAtivar(interaction, enabled) {
  const cfg = await getConfig(interaction.guildId);
  if (enabled && !cfg?.goodbye_channel_id && !cfg?.channel_id) {
    return reply(interaction, err('Defina um canal primeiro com `/boasvindas saida canal`.'));
  }
  await setConfig(interaction.guildId, { goodbye_enabled: enabled });
  return reply(
    interaction,
    ok(enabled ? 'Mensagens de saída ativadas.' : 'Mensagens de saída desativadas.'),
  );
}

async function cmdVer(interaction) {
  const cfg = await getConfig(interaction.guildId);
  if (!cfg) {
    return reply(
      interaction,
      err('Boas-vindas ainda não configuradas. Comece com `/boasvindas canal`.'),
    );
  }

  const canal = await resolveChannel(interaction.guild, cfg.channel_id);
  const canalSaida = await resolveChannel(
    interaction.guild,
    cfg.goodbye_channel_id || cfg.channel_id,
  );
  const dias = cfg.new_account_days ?? DEFAULT_NEW_ACCOUNT_DAYS;

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('Boas-vindas — configuração')
    .addFields(
      { name: 'Entrada', value: cfg.enabled ? '✅ Ativada' : '⛔ Desativada', inline: true },
      { name: 'Canal', value: canal ? canal.toString() : '⚠️ indisponível', inline: true },
      { name: 'Mensagem', value: cfg.message || DEFAULT_MESSAGE },
      {
        name: 'Saída',
        value: cfg.goodbye_enabled ? '✅ Ativada' : '⛔ Desativada',
        inline: true,
      },
      {
        name: 'Canal de saída',
        value: canalSaida ? canalSaida.toString() : '⚠️ indisponível',
        inline: true,
      },
      { name: 'Mensagem de saída', value: cfg.goodbye_message || DEFAULT_GOODBYE },
      {
        name: 'Aviso de conta recente',
        value: dias > 0 ? `menos de ${dias} dia(s)` : '— desativado —',
        inline: true,
      },
      { name: 'Imagens', value: `${cfg.images?.length ?? 0} cadastrada(s)`, inline: true },
    );

  const alertas = [];
  if (canal) {
    const faltando = missingPermissions(canal, interaction.guild.members.me);
    if (faltando.length) alertas.push(`Canal de entrada: faltam **${faltando.join(', ')}**`);
  }
  if (alertas.length) embed.addFields({ name: '⚠️ Problemas', value: alertas.join('\n') });

  return reply(interaction, embed);
}

// Deixa o admin ver o resultado sem precisar de uma conta extra pra entrar no servidor.
async function cmdTestar(interaction) {
  await interaction.deferReply({ flags: 64 });
  const cfg = (await getConfig(interaction.guildId)) ?? {};
  const tipo = interaction.options.getString('tipo') ?? 'entrada';
  const payload =
    tipo === 'saida'
      ? { embeds: [buildGoodbyeEmbed(interaction.member, cfg)] }
      : await buildWelcomePayload(interaction.member, cfg);

  const alvo = await resolveChannel(
    interaction.guild,
    tipo === 'saida' ? cfg.goodbye_channel_id || cfg.channel_id : cfg.channel_id,
  );

  return interaction.editReply({
    content: `Prévia — no evento real vai para ${alvo?.toString() ?? '*(canal não definido)*'}.`,
    ...payload,
  });
}

const HANDLERS = {
  canal: cmdCanal,
  mensagem: cmdMensagem,
  'conta-nova': cmdContaNova,
  ativar: (i) => cmdAtivar(i, true),
  desativar: (i) => cmdAtivar(i, false),
  ver: cmdVer,
  testar: cmdTestar,
  'imagem:adicionar': cmdImagemAdicionar,
  'imagem:remover': cmdImagemRemover,
  'imagem:listar': cmdImagemListar,
  'saida:canal': cmdSaidaCanal,
  'saida:mensagem': cmdSaidaMensagem,
  'saida:ativar': (i) => cmdSaidaAtivar(i, true),
  'saida:desativar': (i) => cmdSaidaAtivar(i, false),
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('boasvindas')
    .setDescription('Configura as mensagens de boas-vindas e saída (apenas admins)')
    // Some da lista de quem não é admin. A checagem no execute continua valendo:
    // o dono pode liberar por cargo em Configurações → Integrações.
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((s) =>
      s
        .setName('canal')
        .setDescription('Define o canal das boas-vindas')
        .addChannelOption((o) =>
          o
            .setName('canal')
            .setDescription('Canal de texto')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('mensagem')
        .setDescription('Personaliza o texto de entrada')
        .addStringOption((o) =>
          o
            .setName('texto')
            .setDescription('Use {membro}, {usuario}, {servidor} e {contagem}')
            .setRequired(true)
            .setMaxLength(2000),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('conta-nova')
        .setDescription('Marca no embed contas criadas há pouco tempo')
        .addIntegerOption((o) =>
          o
            .setName('dias')
            .setDescription('Limite em dias (0 desativa)')
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(90),
        ),
    )
    .addSubcommand((s) => s.setName('ativar').setDescription('Ativa as boas-vindas'))
    .addSubcommand((s) => s.setName('desativar').setDescription('Desativa as boas-vindas'))
    .addSubcommand((s) => s.setName('ver').setDescription('Mostra a configuração atual'))
    .addSubcommand((s) =>
      s
        .setName('testar')
        .setDescription('Mostra uma prévia')
        .addStringOption((o) =>
          o
            .setName('tipo')
            .setDescription('Qual mensagem visualizar')
            .addChoices({ name: 'Entrada', value: 'entrada' }, { name: 'Saída', value: 'saida' }),
        ),
    )
    .addSubcommandGroup((g) =>
      g
        .setName('imagem')
        .setDescription('Imagens sorteadas no embed de entrada')
        .addSubcommand((s) =>
          s
            .setName('adicionar')
            .setDescription('Adiciona uma imagem ao sorteio')
            .addStringOption((o) => o.setName('url').setDescription('URL https').setRequired(true)),
        )
        .addSubcommand((s) =>
          s
            .setName('remover')
            .setDescription('Remove uma imagem pelo número')
            .addIntegerOption((o) =>
              o
                .setName('indice')
                .setDescription('Número na lista')
                .setRequired(true)
                .setMinValue(1),
            ),
        )
        .addSubcommand((s) => s.setName('listar').setDescription('Lista as imagens cadastradas')),
    )
    .addSubcommandGroup((g) =>
      g
        .setName('saida')
        .setDescription('Mensagem de quem sai do servidor')
        .addSubcommand((s) =>
          s
            .setName('canal')
            .setDescription('Define o canal das mensagens de saída')
            .addChannelOption((o) =>
              o
                .setName('canal')
                .setDescription('Canal de texto')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true),
            ),
        )
        .addSubcommand((s) =>
          s
            .setName('mensagem')
            .setDescription('Personaliza o texto de saída')
            .addStringOption((o) =>
              o
                .setName('texto')
                .setDescription('Use {usuario}, {servidor} e {contagem}')
                .setRequired(true)
                .setMaxLength(2000),
            ),
        )
        .addSubcommand((s) => s.setName('ativar').setDescription('Ativa as mensagens de saída'))
        .addSubcommand((s) =>
          s.setName('desativar').setDescription('Desativa as mensagens de saída'),
        ),
    ),

  async execute(interaction) {
    if (!interaction.member.permissions.has('Administrator')) {
      return reply(interaction, err('Apenas administradores podem configurar as boas-vindas.'));
    }

    const grupo = interaction.options.getSubcommandGroup(false);
    const sub = interaction.options.getSubcommand();
    const handler = HANDLERS[grupo ? `${grupo}:${sub}` : sub];
    if (handler) return handler(interaction);
  },
};

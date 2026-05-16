const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { EMOJIS, COLORS, MIN_DURATION, MAX_DURATION } = require('../config/constants');
const { buildGiveawayEmbed, buildErrorEmbed, buildSuccessEmbed } = require('../utils/embeds');
const { parseDuration } = require('../utils/duration');
const { buildParticipateButton, buildDisabledButton, selectWinners, endGiveaway, scheduleGiveaway } = require('../utils/giveawayManager');
const db = require('../utils/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Sistema de sorteos')
    // Requiere solo "Gestionar servidor" — cualquier admin/mod puede usarlo
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

    .addSubcommand(sub =>
      sub.setName('crear')
        .setDescription('Crea un nuevo sorteo en este canal')
        .addStringOption(o => o.setName('premio').setDescription('¿Qué se sortea?').setRequired(true).setMaxLength(100))
        .addStringOption(o => o.setName('duracion').setDescription('Duración. Ej: 1h, 30m, 2d, 1h30m').setRequired(true))
        .addIntegerOption(o => o.setName('ganadores').setDescription('Número de ganadores (máx 20)').setRequired(true).setMinValue(1).setMaxValue(20))
        .addChannelOption(o => o.setName('canal').setDescription('Canal donde publicar (por defecto este canal)').setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName('terminar')
        .setDescription('Finaliza un sorteo activo antes de tiempo')
        .addStringOption(o => o.setName('id').setDescription('ID del mensaje del sorteo').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('reroll')
        .setDescription('Elige nuevos ganadores de un sorteo ya finalizado')
        .addStringOption(o => o.setName('id').setDescription('ID del mensaje del sorteo').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('participantes')
        .setDescription('Muestra la lista de participantes de un sorteo')
        .addStringOption(o => o.setName('id').setDescription('ID del mensaje del sorteo').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('cancelar')
        .setDescription('Cancela un sorteo activo sin elegir ganadores')
        .addStringOption(o => o.setName('id').setDescription('ID del mensaje del sorteo').setRequired(true))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'crear')         return handleCrear(interaction);
    if (sub === 'terminar')      return handleTerminar(interaction);
    if (sub === 'reroll')        return handleReroll(interaction);
    if (sub === 'participantes') return handleParticipantes(interaction);
    if (sub === 'cancelar')      return handleCancelar(interaction);
  },
};

// ── CREAR ──────────────────────────────────────────────────────────────────────
async function handleCrear(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const prize        = interaction.options.getString('premio');
  const durationStr  = interaction.options.getString('duracion');
  const winnersCount = interaction.options.getInteger('ganadores');
  const targetCh     = interaction.options.getChannel('canal') || interaction.channel;

  const durationMs = parseDuration(durationStr);
  if (!durationMs)              return interaction.editReply({ embeds: [buildErrorEmbed(`Duración inválida: \`${durationStr}\`\nEjemplos: \`1h\`, \`30m\`, \`2d\`, \`1h30m\`, \`10s\``)] });
  if (durationMs < MIN_DURATION) return interaction.editReply({ embeds: [buildErrorEmbed('La duración mínima es **10 segundos**.')] });
  if (durationMs > MAX_DURATION) return interaction.editReply({ embeds: [buildErrorEmbed('La duración máxima es **30 días**.')] });
  if (!targetCh.isTextBased())  return interaction.editReply({ embeds: [buildErrorEmbed('El canal debe ser de texto.')] });

  const endsAt = Date.now() + durationMs;
  const temp = {
    prize, hostId: interaction.user.id, winnersCount, endsAt,
    participants: [], active: true, messageId: 'pending',
    channelId: targetCh.id, guildId: interaction.guild.id, createdAt: Date.now(),
  };

  const msg = await targetCh.send({ embeds: [buildGiveawayEmbed(temp)], components: [buildParticipateButton(0)] });
  const giveaway = { ...temp, messageId: msg.id };
  db.save(giveaway);
  scheduleGiveaway(interaction.client, giveaway);

  await interaction.editReply({ embeds: [buildSuccessEmbed(`¡Sorteo creado en ${targetCh}! → [Ver mensaje](${msg.url})`)] });
}

// ── TERMINAR ───────────────────────────────────────────────────────────────────
async function handleTerminar(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const id = interaction.options.getString('id').trim();
  const g  = db.get(id);
  if (!g || g.guildId !== interaction.guild.id) return interaction.editReply({ embeds: [buildErrorEmbed('No encontré ese sorteo en este servidor.')] });
  if (!g.active)                                 return interaction.editReply({ embeds: [buildErrorEmbed('Este sorteo ya finalizó.')] });
  await endGiveaway(interaction.client, id);
  await interaction.editReply({ embeds: [buildSuccessEmbed('Sorteo finalizado manualmente.')] });
}

// ── REROLL ─────────────────────────────────────────────────────────────────────
async function handleReroll(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const id = interaction.options.getString('id').trim();
  const g  = db.get(id);
  if (!g || g.guildId !== interaction.guild.id) return interaction.editReply({ embeds: [buildErrorEmbed('No encontré ese sorteo en este servidor.')] });
  if (g.active)                                  return interaction.editReply({ embeds: [buildErrorEmbed('El sorteo aún está activo. Usa `/giveaway terminar` primero.')] });
  if (!g.participants?.length)                   return interaction.editReply({ embeds: [buildErrorEmbed('No hay participantes para hacer reroll.')] });

  const winners = selectWinners(g.participants, g.winnersCount);
  g.winners = winners;
  db.save(g);

  const channel = await interaction.guild.channels.fetch(g.channelId).catch(() => null);
  if (channel) {
    await channel.send({
      content: `${EMOJIS.LUCK} **¡Reroll!** Nuevos ganadores de **${g.prize}**: ${winners.map(id => `<@${id}>`).join(', ') || 'Nadie'}`,
    });
  }

  await interaction.editReply({ embeds: [buildSuccessEmbed('Reroll realizado. Nuevos ganadores anunciados.')] });
}

// ── PARTICIPANTES ──────────────────────────────────────────────────────────────
async function handleParticipantes(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const id = interaction.options.getString('id').trim();
  const g  = db.get(id);
  if (!g || g.guildId !== interaction.guild.id) return interaction.editReply({ embeds: [buildErrorEmbed('No encontré ese sorteo en este servidor.')] });

  const list = g.participants || [];
  const embed = new EmbedBuilder()
    .setTitle(`${EMOJIS.USERS} Participantes — ${g.prize}`)
    .setColor(COLORS.PRIMARY)
    .setDescription(
      list.length === 0
        ? '*Nadie ha participado aún.*'
        : list.slice(0, 50).map((id, i) => `${i + 1}. <@${id}>`).join('\n') +
          (list.length > 50 ? `\n*...y ${list.length - 50} más*` : '')
    )
    .setFooter({ text: `Total: ${list.length} participante(s)` });

  await interaction.editReply({ embeds: [embed] });
}

// ── CANCELAR ───────────────────────────────────────────────────────────────────
async function handleCancelar(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const id = interaction.options.getString('id').trim();
  const g  = db.get(id);
  if (!g || g.guildId !== interaction.guild.id) return interaction.editReply({ embeds: [buildErrorEmbed('No encontré ese sorteo en este servidor.')] });
  if (!g.active)                                 return interaction.editReply({ embeds: [buildErrorEmbed('Este sorteo ya está finalizado.')] });

  g.active = false;
  g.cancelled = true;
  db.save(g);

  try {
    const channel = await interaction.guild.channels.fetch(g.channelId).catch(() => null);
    if (channel) {
      const message = await channel.messages.fetch(id).catch(() => null);
      if (message) {
        const cancelEmbed = new EmbedBuilder()
          .setTitle(`${EMOJIS.CANCEL} Sorteo Cancelado — ${g.prize}`)
          .setColor(COLORS.ERROR)
          .setDescription(`Cancelado por <@${interaction.user.id}>.`)
          .setTimestamp();
        await message.edit({ embeds: [cancelEmbed], components: [buildDisabledButton('Cancelado')] });
      }
    }
  } catch {}

  await interaction.editReply({ embeds: [buildSuccessEmbed('Sorteo cancelado correctamente.')] });
}

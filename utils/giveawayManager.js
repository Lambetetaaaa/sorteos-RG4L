const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('./database');
const { buildGiveawayEmbed } = require('./embeds');
const { EMOJIS } = require('../config/constants');

const activeTimers = new Map();

function buildParticipateButton(count = 0) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('giveaway_join')
      .setLabel(`${EMOJIS.TICKET} Participar (${count})`)
      .setStyle(ButtonStyle.Primary)
  );
}

function buildDisabledButton(label = 'Finalizado') {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('giveaway_join')
      .setLabel(`${EMOJIS.TICKET} ${label}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true)
  );
}

function selectWinners(participants, count) {
  const pool = [...participants];
  const winners = [];
  while (winners.length < count && pool.length > 0) {
    const idx = Math.floor(Math.random() * pool.length);
    winners.push(pool.splice(idx, 1)[0]);
  }
  return winners;
}

async function endGiveaway(client, messageId) {
  const g = db.get(messageId);
  if (!g || !g.active) return;

  if (activeTimers.has(messageId)) {
    clearTimeout(activeTimers.get(messageId));
    activeTimers.delete(messageId);
  }

  try {
    const guild   = await client.guilds.fetch(g.guildId).catch(() => null);
    if (!guild) return;
    const channel = await guild.channels.fetch(g.channelId).catch(() => null);
    if (!channel) return;
    const message = await channel.messages.fetch(messageId).catch(() => null);
    if (!message) return;

    const winners = selectWinners(g.participants || [], g.winnersCount);
    g.active = false;
    g.winners = winners;
    g.endedAt = Date.now();
    db.save(g);

    await message.edit({
      embeds: [buildGiveawayEmbed(g)],
      components: [buildDisabledButton('Sorteo Finalizado')],
    });

    if (winners.length > 0) {
      await channel.send({
        content: `${EMOJIS.WIN} ¡Felicidades ${winners.map(id => `<@${id}>`).join(', ')}! Ganaron **${g.prize}**. <@${g.hostId}> se pondrá en contacto pronto.`,
      });
    } else {
      await channel.send({
        content: `${EMOJIS.WARN} El sorteo de **${g.prize}** finalizó sin participantes.`,
      });
    }
  } catch (err) {
    console.error(`❌ Error al finalizar sorteo ${messageId}:`, err.message);
  }
}

function scheduleGiveaway(client, g) {
  const remaining = g.endsAt - Date.now();
  if (remaining <= 0) { endGiveaway(client, g.messageId); return; }
  const timer = setTimeout(() => endGiveaway(client, g.messageId), remaining);
  activeTimers.set(g.messageId, timer);
}

async function restoreGiveaways(client) {
  const active = db.getAll().filter(g => g.active);
  console.log(`🔄 Restaurando ${active.length} sorteo(s) activo(s)...`);
  for (const g of active) {
    scheduleGiveaway(client, g);
    try {
      const guild   = await client.guilds.fetch(g.guildId).catch(() => null);
      if (!guild) continue;
      const channel = await guild.channels.fetch(g.channelId).catch(() => null);
      if (!channel) continue;
      const message = await channel.messages.fetch(g.messageId).catch(() => null);
      if (!message) continue;
      await message.edit({
        embeds: [buildGiveawayEmbed(g)],
        components: [buildParticipateButton(g.participants?.length || 0)],
      });
    } catch {}
  }
}

module.exports = { buildParticipateButton, buildDisabledButton, selectWinners, endGiveaway, scheduleGiveaway, restoreGiveaways };

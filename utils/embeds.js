const { EmbedBuilder } = require('discord.js');
const { COLORS, EMOJIS } = require('../config/constants');
const { toDiscordTimestamp } = require('./duration');

function buildGiveawayEmbed(g) {
  const ended = !g.active;
  const embed = new EmbedBuilder()
    .setTitle(`${EMOJIS.GIVEAWAY} ${g.prize}`)
    .setColor(ended ? COLORS.ENDED : COLORS.PRIMARY)
    .addFields(
      { name: `${EMOJIS.HOST} Organizado por`, value: `<@${g.hostId}>`, inline: true },
      { name: `${EMOJIS.WIN} Ganadores`,        value: `**${g.winnersCount}**`, inline: true },
      { name: `${EMOJIS.USERS} Participantes`,  value: `**${g.participants?.length || 0}**`, inline: true },
      {
        name: `${EMOJIS.TIME} Termina`,
        value: ended
          ? '**¡Finalizado!**'
          : `${toDiscordTimestamp(g.endsAt, 'R')}\n${toDiscordTimestamp(g.endsAt, 'F')}`,
      },
    )
    .setFooter({ text: ended ? `ID: ${g.messageId}` : `ID: ${g.messageId} • Haz clic para participar` })
    .setTimestamp(g.endsAt);

  if (ended && g.winners?.length > 0)
    embed.addFields({ name: `${EMOJIS.WIN} Ganadores`, value: g.winners.map(id => `<@${id}>`).join(', ') });
  if (ended && !g.cancelled && (!g.winners || g.winners.length === 0))
    embed.addFields({ name: `${EMOJIS.WARN} Sin ganadores`, value: 'No hubo suficientes participantes.' });

  return embed;
}

function buildErrorEmbed(msg) {
  return new EmbedBuilder().setColor(COLORS.ERROR).setDescription(`${EMOJIS.ERROR} ${msg}`);
}

function buildSuccessEmbed(msg) {
  return new EmbedBuilder().setColor(COLORS.SUCCESS).setDescription(`${EMOJIS.SUCCESS} ${msg}`);
}

module.exports = { buildGiveawayEmbed, buildErrorEmbed, buildSuccessEmbed };

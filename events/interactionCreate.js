const { COOLDOWN_SECONDS, EMOJIS } = require('../config/constants');
const { buildErrorEmbed, buildGiveawayEmbed } = require('../utils/embeds');
const { buildParticipateButton } = require('../utils/giveawayManager');
const db = require('../utils/database');

const cooldowns = new Map();

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {

    // ── SLASH COMMANDS ──────────────────────────────────────────────────
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;

      // Anti-spam
      const now = Date.now();
      const cdMs = COOLDOWN_SECONDS * 1000;
      const last = cooldowns.get(interaction.user.id);
      if (last && now - last < cdMs) {
        const rem = ((cdMs - (now - last)) / 1000).toFixed(1);
        return interaction.reply({
          embeds: [buildErrorEmbed(`Espera **${rem}s** antes de usar otro comando.`)],
          ephemeral: true,
        });
      }
      cooldowns.set(interaction.user.id, now);
      if (cooldowns.size > 500) {
        for (const [id, ts] of cooldowns) if (now - ts > cdMs * 2) cooldowns.delete(id);
      }

      try {
        await command.execute(interaction);
      } catch (err) {
        console.error(`❌ /${interaction.commandName}:`, err.message);
        const embed = buildErrorEmbed('Error inesperado. Intenta de nuevo.');
        if (interaction.deferred || interaction.replied)
          await interaction.editReply({ embeds: [embed] }).catch(() => {});
        else
          await interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => {});
      }
    }

    // ── BOTÓN PARTICIPAR ────────────────────────────────────────────────
    if (interaction.isButton() && interaction.customId === 'giveaway_join') {
      await interaction.deferUpdate().catch(() => {});

      const giveaway = db.get(interaction.message.id);
      const userId = interaction.user.id;

      if (!giveaway || !giveaway.active) {
        return interaction.followUp({
          embeds: [buildErrorEmbed('Este sorteo ya finalizó o no existe.')],
          ephemeral: true,
        });
      }

      // Toggle participación
      if (giveaway.participants.includes(userId)) {
        giveaway.participants = giveaway.participants.filter(id => id !== userId);
        db.save(giveaway);
        await interaction.message.edit({
          embeds: [buildGiveawayEmbed(giveaway)],
          components: [buildParticipateButton(giveaway.participants.length)],
        }).catch(() => {});
        return interaction.followUp({
          embeds: [buildErrorEmbed(`Saliste del sorteo de **${giveaway.prize}**.`)],
          ephemeral: true,
        });
      }

      giveaway.participants.push(userId);
      db.save(giveaway);
      await interaction.message.edit({
        embeds: [buildGiveawayEmbed(giveaway)],
        components: [buildParticipateButton(giveaway.participants.length)],
      }).catch(() => {});

      return interaction.followUp({
        embeds: [{
          color: 0x57F287,
          description: `${EMOJIS.SUCCESS} ¡Participas en el sorteo de **${giveaway.prize}**!\n\nHaz clic de nuevo para **salir**.`,
        }],
        ephemeral: true,
      });
    }
  },
};

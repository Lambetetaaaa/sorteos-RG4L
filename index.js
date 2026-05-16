const { Client, GatewayIntentBits, Collection, Partials } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

if (!process.env.TOKEN || !process.env.CLIENT_ID) {
  console.error('❌ Faltan TOKEN o CLIENT_ID en el .env');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel],
});

client.commands = new Collection();

// Cargar comandos
for (const file of fs.readdirSync('./commands').filter(f => f.endsWith('.js'))) {
  const cmd = require(`./commands/${file}`);
  if (cmd.data && cmd.execute) {
    client.commands.set(cmd.data.name, cmd);
    console.log(`✅ Comando cargado: ${cmd.data.name}`);
  }
}

// Cargar eventos
for (const file of fs.readdirSync('./events').filter(f => f.endsWith('.js'))) {
  const event = require(`./events/${file}`);
  if (event.once) client.once(event.name, (...args) => event.execute(...args, client));
  else            client.on(event.name,   (...args) => event.execute(...args, client));
  console.log(`✅ Evento cargado: ${event.name}`);
}

// Restaurar sorteos al arrancar
client.once('clientReady', async () => {
  const { restoreGiveaways } = require('./utils/giveawayManager');
  await restoreGiveaways(client);
});

client.login(process.env.TOKEN);

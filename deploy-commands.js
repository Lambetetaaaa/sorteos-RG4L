const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const { TOKEN, CLIENT_ID } = process.env;

if (!TOKEN || !CLIENT_ID) {
  console.error('❌ Faltan TOKEN o CLIENT_ID en el .env');
  process.exit(1);
}

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
for (const file of fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'))) {
  const cmd = require(path.join(commandsPath, file));
  if (cmd.data) commands.push(cmd.data.toJSON());
}

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    console.log(`🔄 Registrando ${commands.length} comandos globalmente...`);
    const data = await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log(`✅ ${data.length} comandos registrados globalmente.`);
  } catch (err) {
    console.error('❌ Error al registrar comandos:', err.message);
    process.exit(1);
  }
})();

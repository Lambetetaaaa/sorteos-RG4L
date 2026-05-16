const fs = require('fs');
const path = require('path');
const DATA_PATH = path.join(__dirname, '../data/giveaways.json');

function ensureFile() {
  const dir = path.dirname(DATA_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DATA_PATH)) fs.writeFileSync(DATA_PATH, '{}');
}

function readAll() {
  ensureFile();
  try { return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8')); }
  catch { return {}; }
}

function writeAll(data) {
  ensureFile();
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

module.exports = {
  save(g)         { const a = readAll(); a[g.messageId] = g; writeAll(a); },
  get(id)         { return readAll()[id] || null; },
  remove(id)      { const a = readAll(); delete a[id]; writeAll(a); },
  getAll()        { return Object.values(readAll()); },
};

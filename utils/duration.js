function parseDuration(str) {
  if (!str) return null;
  const regex = /(\d+)\s*(s|seg|m|min|h|hr|d|dia|dias)/gi;
  let total = 0, matched = false, match;
  while ((match = regex.exec(str)) !== null) {
    matched = true;
    const v = parseInt(match[1]);
    const u = match[2].toLowerCase();
    if (['s','seg'].includes(u))            total += v * 1000;
    else if (['m','min'].includes(u))       total += v * 60000;
    else if (['h','hr'].includes(u))        total += v * 3600000;
    else if (['d','dia','dias'].includes(u))total += v * 86400000;
  }
  return matched ? total : null;
}

function toDiscordTimestamp(ms, format = 'R') {
  return `<t:${Math.floor(ms / 1000)}:${format}>`;
}

module.exports = { parseDuration, toDiscordTimestamp };

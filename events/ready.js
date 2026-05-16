module.exports = {
  name: 'clientReady',
  once: true,
  execute(client) {
    console.log(`✅ Bot conectado como ${client.user.tag}`);
    client.user.setActivity('🎉 /giveaway crear', { type: 3 });
  },
};

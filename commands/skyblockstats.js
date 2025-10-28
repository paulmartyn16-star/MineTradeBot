// index.js oder in Deinem Befehls-Handler ergänzen (Bruder)
const { SlashCommandBuilder } = require('discord.js');
const fetch = require('node-fetch');  // Falls noch nicht installiert: npm install node-fetch

module.exports = {
  data: new SlashCommandBuilder()
    .setName('skyblockstats')
    .setDescription('Holt die SkyBlock-Profil-Daten eines Spielers')
    .addStringOption(option =>
      option.setName('username')
            .setDescription('Minecraft Benutzername')
            .setRequired(true)),
  async execute(interaction) {
    const username = interaction.options.getString('username');
    await interaction.deferReply();  // Wenn API-Aufruf dauert

    try {
      // 1. username → UUID (via Mojang API)
      const uuidResponse = await fetch(`https://api.mojang.com/users/profiles/minecraft/${username}`);
      if (!uuidResponse.ok) throw new Error('Username nicht gefunden');
      const uuidData = await uuidResponse.json();
      const uuid = uuidData.id;

      // 2. SkyBlock Profil Daten abrufen
      const API_KEY = process.env.HYPIXEL_API_KEY;  // ENV Var verwenden
      const profileResponse = await fetch(`https://api.hypixel.net/v2/skyblock/profile?key=${API_KEY}&uuid=${uuid}`);
      if (!profileResponse.ok) throw new Error('Fehler beim API-Aufruf');
      const profileData = await profileResponse.json();

      // 3. Daten extrahieren (z. B. erstes Profil)
      if (!profileData.success || !profileData.profiles || profileData.profiles.length === 0) {
        throw new Error('Keine SkyBlock-Profile gefunden');
      }
      const profile = profileData.profiles[0];
      const weight = profile.weight ?? 'Nicht verfügbar';

      // 4. Antwort senden
      await interaction.editReply(`📊 SkyBlock Daten für **${username}**:\n• Profil-Name: ${profile.profile_name}\n• Weight: ${weight}`);
    }
    catch (error) {
      console.error(error);
      await interaction.editReply(`❌ Fehler: ${error.message}`);
    }
  },
};

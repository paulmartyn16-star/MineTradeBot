try {
  // === Hole UUID vom Minecraft-Namen über Mojang-API ===
  const mojangResponse = await fetch(`https://api.mojang.com/users/profiles/minecraft/${mcName}`);
  if (!mojangResponse.ok) {
    return interaction.editReply("❌ Minecraft account not found!");
  }

  const mojangData = await mojangResponse.json();
  const uuid = mojangData.id; // Mojang gibt ID bereits ohne Bindestriche

  if (!uuid) {
    return interaction.editReply("❌ Could not fetch UUID for this Minecraft name.");
  }

  // === Hole SkyBlock-Profile von Hypixel ===
  const apiKey = process.env.HYPIXEL_API_KEY;
  const skyblockURL = `https://api.hypixel.net/v2/skyblock/profiles?key=${apiKey}&uuid=${uuid}`;
  const skyRes = await fetch(skyblockURL);
  const skyData = await skyRes.json();

  console.log("Skyblock API Response:", JSON.stringify(skyData, null, 2));

  if (!skyData.success) {
    return interaction.editReply(`❌ Hypixel API Error: ${skyData.cause || "Unknown"}`);
  }

  if (!skyData.profiles || skyData.profiles.length === 0) {
    return interaction.editReply("⚠️ No SkyBlock profiles found. Make sure your SkyBlock API access is enabled!");
  }

  // === Nimm das aktuellste Profil ===
  const profile = skyData.profiles.sort((a, b) =>
    (b.members[uuid]?.last_save || 0) - (a.members[uuid]?.last_save || 0)
  )[0];

  const member = profile.members[uuid];

  // === Beispielwerte (zum Testen) ===
  const level = Math.round((member.leveling?.experience || 0) / 100);
  const purse = member.coin_purse?.toLocaleString() || "N/A";

  const embed = new EmbedBuilder()
    .setColor("#FFD700")
    .setTitle(`💎 SkyBlock Stats for ${mcName}`)
    .setThumbnail(`https://mc-heads.net/avatar/${mcName}`)
    .addFields(
      { name: "🧠 Level", value: `${level}`, inline: true },
      { name: "💰 Purse", value: `${purse} Coins`, inline: true },
    )
    .setFooter({ text: "MineTrade | Hypixel API", iconURL: process.env.FOOTER_ICON });

  await interaction.editReply({ embeds: [embed] });
} catch (err) {
  console.error("❌ Error fetching Hypixel data:", err);
  await interaction.editReply("❌ Error fetching Hypixel data. Please try again later.");
}

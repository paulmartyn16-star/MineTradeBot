// commands/list.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const fetch = require("node-fetch");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("list")
    .setDescription("List a Hypixel SkyBlock account for sale.")
    .addStringOption(opt =>
      opt.setName("account")
        .setDescription("Minecraft username of the account")
        .setRequired(true))
    .addIntegerOption(opt =>
      opt.setName("price")
        .setDescription("Price in USD")
        .setRequired(true))
    .addUserOption(opt =>
      opt.setName("listedby")
        .setDescription("Who is listing the account?")
        .setRequired(true)),

  async execute(interaction) {
    const mcName = interaction.options.getString("account");
    const price = interaction.options.getInteger("price");
    const listedBy = interaction.options.getUser("listedby");
    const apiKey = process.env.HYPIXEL_API_KEY;

    await interaction.deferReply();

    try {
      // === Hole UUID vom Minecraft-Namen über Mojang-API ===
      const mojangResponse = await fetch(`https://api.mojang.com/users/profiles/minecraft/${mcName}`);
      if (!mojangResponse.ok) {
        return interaction.editReply("❌ Minecraft account not found!");
      }

      const mojangData = await mojangResponse.json();
      const uuid = mojangData.id; // Mojang gibt ID ohne Bindestriche

      if (!uuid) {
        return interaction.editReply("❌ Could not fetch UUID for this Minecraft name.");
      }

      // === Hole SkyBlock-Profile von Hypixel ===
      const skyRes = await fetch(`https://api.hypixel.net/v2/skyblock/profiles?key=${apiKey}&uuid=${uuid}`);
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
          { name: "🎮 Account", value: `\`${mcName}\``, inline: true },
          { name: "💰 Price", value: `$${price}`, inline: true },
          { name: "📋 Listed by", value: `<@${listedBy.id}>`, inline: true },
          { name: "🧠 Level", value: `${level}`, inline: true },
          { name: "💵 Purse", value: `${purse} Coins`, inline: true },
        )
        .setFooter({ text: "MineTrade | Hypixel API", iconURL: process.env.FOOTER_ICON });

      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("buy_account").setLabel("💵 Buy Account").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("update_stats").setLabel("🔄 Update Stats").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("unlist_account").setLabel("🗑️ Unlist").setStyle(ButtonStyle.Danger)
      );

      await interaction.editReply({ embeds: [embed], components: [buttons] });
    } catch (err) {
      console.error("❌ Error fetching Hypixel data:", err);
      await interaction.editReply("❌ Error fetching Hypixel data. Please try again later.");
    }
  },
};

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

    await interaction.deferReply();

    try {
      // === Fetch SkyBlock Data from Shiiyu API (no key needed) ===
      const res = await fetch(`https://sky.shiiyu.moe/api/v2/profile/${mcName}`);
      if (!res.ok) return interaction.editReply("❌ Failed to fetch player data. Maybe the username is invalid?");
      const data = await res.json();

      // Check if player has any SkyBlock profiles
      if (!data.profiles || Object.keys(data.profiles).length === 0) {
        return interaction.editReply("⚠️ No SkyBlock profiles found for this player.");
      }

      // Get most recent profile
      const profileData = Object.values(data.profiles)[0].data;
      const general = profileData?.stats || {};

      // Extract some basic stats
      const skillAvg = general?.average_level?.toFixed(2) || "N/A";
      const catacombs = general?.catacombs?.level?.toFixed(2) || "N/A";
      const networth = general?.networth?.networth?.toLocaleString() || "Unknown";
      const level = profileData?.skyblock_level?.level || "N/A";
      const slayers = profileData?.slayer?.xp || {};
      const slayerString = Object.entries(slayers)
        .map(([boss, xp]) => `${boss}: ${Math.round(xp / 1000)}k XP`)
        .join("\n");

      // === Build Embed ===
      const embed = new EmbedBuilder()
        .setColor("#FFD700")
        .setTitle("💎 Account Information")
        .setThumbnail(`https://mc-heads.net/avatar/${mcName}`)
        .addFields(
          { name: "🎮 Rank", value: `${general.rank || "N/A"}`, inline: true },
          { name: "🧠 Skill Average", value: `${skillAvg}`, inline: true },
          { name: "🏰 Catacombs", value: `${catacombs}`, inline: true },
          { name: "⚔️ Slayers", value: slayerString || "N/A", inline: false },
          { name: "💰 Networth", value: `${networth} Coins`, inline: true },
          { name: "📈 Level", value: `${level}`, inline: true },
          { name: "💵 Price", value: `$${price}`, inline: true },
          { name: "📋 Listed by", value: `<@${listedBy.id}>`, inline: true }
        )
        .setFooter({ text: "MineTrade | Verified via Shiiyu API", iconURL: process.env.FOOTER_ICON });

      // === Action Buttons ===
      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("buy_account").setLabel("💵 Buy Account").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("update_stats").setLabel("🔄 Update Stats").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("unlist_account").setLabel("🗑️ Unlist").setStyle(ButtonStyle.Danger)
      );

      await interaction.editReply({ embeds: [embed], components: [buttons] });
    } catch (err) {
      console.error("❌ Error fetching Shiiyu API:", err);
      await interaction.editReply("❌ Error while fetching SkyBlock data. Please try again later.");
    }
  },
};

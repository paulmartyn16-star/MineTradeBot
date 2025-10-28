// ==========================================================
// /commands/list.js — FINAL VERSION (SkyCrypt + Ashcon, no API key needed)
// ==========================================================
const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
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

    try {
      await interaction.deferReply({ ephemeral: false });

      // === Step 1: Get UUID via Ashcon ===
      const ashcon = await fetch(`https://api.ashcon.app/mojang/v2/user/${mcName}`);
      if (!ashcon.ok) {
        return await interaction.editReply("❌ Invalid Minecraft username or player not found.");
      }
      const ashconData = await ashcon.json();
      const uuid = ashconData.uuid.replace(/-/g, "");

      // === Step 2: Fetch SkyBlock data via SkyCrypt Proxy ===
      const skycrypt = await fetch(`https://sky.shiiyu.moe/api/v2/profile/${uuid}`);
      if (!skycrypt.ok) {
        console.log("SkyCrypt API Error:", skycrypt.status, skycrypt.statusText);
        return await interaction.editReply("⚠️ No SkyBlock data found for this player. Maybe API access is off or profile is private.");
      }

      const data = await skycrypt.json();
      const profiles = data.profiles;
      if (!profiles || Object.keys(profiles).length === 0) {
        return await interaction.editReply("⚠️ No SkyBlock profiles found for this player.");
      }

      // === Step 3: Get the most recent profile ===
      const profile = Object.values(profiles)[0].data;
      const stats = profile.stats || {};
      const slayers = profile.slayer?.xp || {};
      const networth = profile.networth?.networth?.toLocaleString() || "Unknown";
      const skillAvg = stats.average_level?.toFixed(2) || "N/A";
      const catacombs = stats.catacombs?.level?.toFixed(2) || "N/A";
      const level = profile.skyblock_level?.level || "N/A";
      const slayerList = Object.entries(slayers)
        .map(([boss, xp]) => `${boss}: ${Math.round(xp / 1000)}k XP`)
        .join("\n") || "N/A";

      // === Step 4: Embed ===
      const embed = new EmbedBuilder()
        .setColor("#FFD700")
        .setTitle("💎 Account Information")
        .setThumbnail(`https://mc-heads.net/avatar/${mcName}`)
        .addFields(
          { name: "🎮 Account", value: `\`${mcName}\``, inline: true },
          { name: "🧠 Skill Average", value: `${skillAvg}`, inline: true },
          { name: "🏰 Catacombs", value: `${catacombs}`, inline: true },
          { name: "⚔️ Slayers", value: slayerList, inline: false },
          { name: "💰 Networth", value: `${networth} Coins`, inline: true },
          { name: "📈 Level", value: `${level}`, inline: true },
          { name: "💵 Price", value: `$${price}`, inline: true },
          { name: "📋 Listed by", value: `<@${listedBy.id}>`, inline: true }
        )
        .setFooter({
          text: "MineTrade | SkyCrypt Verified",
          iconURL: process.env.FOOTER_ICON,
        });

      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("buy_account").setLabel("💵 Buy").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("update_stats").setLabel("🔄 Update Stats").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("unlist").setLabel("🗑️ Unlist").setStyle(ButtonStyle.Danger)
      );

      await interaction.editReply({ embeds: [embed], components: [buttons] });

    } catch (err) {
      console.error("❌ /list command error:", err);
      if (!interaction.replied) {
        await interaction.reply({ content: "❌ Error executing command.", ephemeral: true }).catch(() => {});
      }
    }
  },
};

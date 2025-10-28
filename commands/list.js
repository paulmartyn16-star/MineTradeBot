// ==========================================================
// /commands/list.js — Stable Version (Ashcon + Shiiyu API)
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

    // acknowledge immediately
    await interaction.deferReply({ ephemeral: false });

    try {
      // --- Step 1: Get UUID from Ashcon ---
      const ashconRes = await fetch(`https://api.ashcon.app/mojang/v2/user/${mcName}`);
      if (!ashconRes.ok) {
        return await interaction.editReply("❌ Could not fetch Minecraft UUID. Make sure the username is valid!");
      }

      const ashconData = await ashconRes.json();
      const uuid = ashconData.uuid;
      if (!uuid) return await interaction.editReply("❌ Player not found on Mojang.");

      // --- Step 2: Get SkyBlock Data from Shiiyu API ---
      const res = await fetch(`https://sky.shiiyu.moe/api/v2/profile/${uuid}`);
      if (!res.ok) {
        console.log("Shiiyu API Error:", res.status, res.statusText);
        return await interaction.editReply("⚠️ No SkyBlock data found. Maybe API Access is disabled on that account.");
      }

      const data = await res.json();
      if (!data || !data.profiles || Object.keys(data.profiles).length === 0) {
        return await interaction.editReply("⚠️ No SkyBlock profiles found for this player.");
      }

      // --- Step 3: Pick most recent profile ---
      const profile = Object.values(data.profiles)[0].data;
      const stats = profile?.stats || {};
      const slayers = profile?.slayer?.xp || {};
      const networth = profile?.networth?.networth?.toLocaleString() || "Unknown";
      const skillAvg = stats?.average_level?.toFixed(2) || "N/A";
      const catacombs = stats?.catacombs?.level?.toFixed(2) || "N/A";
      const level = profile?.skyblock_level?.level || "N/A";
      const slayerList = Object.entries(slayers)
        .map(([boss, xp]) => `${boss}: ${Math.round(xp / 1000)}k XP`)
        .join("\n") || "N/A";

      // --- Step 4: Build Embed ---
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
          text: "MineTrade | Verified via Shiiyu API",
          iconURL: process.env.FOOTER_ICON,
        });

      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("buy_account")
          .setLabel("💵 Buy Account")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("update_stats")
          .setLabel("🔄 Update Stats")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("unlist_account")
          .setLabel("🗑️ Unlist")
          .setStyle(ButtonStyle.Danger)
      );

      await interaction.editReply({ embeds: [embed], components: [buttons] });
    } catch (err) {
      console.error("❌ Error in /list command:", err);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "❌ Error executing command.",
          ephemeral: true,
        }).catch(() => {});
      } else {
        await interaction.editReply("❌ Error executing command.");
      }
    }
  },
};

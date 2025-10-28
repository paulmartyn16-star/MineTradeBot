// ==========================================================
// /commands/list.js — with Working Autocomplete (PlayerDB API)
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
        .setDescription("Minecraft username (auto-suggested)")
        .setAutocomplete(true)
        .setRequired(true))
    .addIntegerOption(opt =>
      opt.setName("price")
        .setDescription("Price in USD")
        .setRequired(true))
    .addUserOption(opt =>
      opt.setName("listedby")
        .setDescription("Who is listing the account?")
        .setRequired(true)),

  // === AUTOCOMPLETE HANDLER ===
  async autocomplete(interaction) {
    const focused = interaction.options.getFocused();

    if (!focused || focused.length < 2) {
      return interaction.respond([]);
    }

    try {
      // PlayerDB API: returns a list of matching names
      const res = await fetch(`https://playerdb.co/api/search/minecraft/${encodeURIComponent(focused)}`);
      const data = await res.json();

      if (!data.success || !data.data || !data.data.players) {
        return interaction.respond([]);
      }

      const results = data.data.players.slice(0, 10).map(player => ({
        name: player.username,
        value: player.username,
      }));

      await interaction.respond(results);
    } catch (err) {
      console.error("Autocomplete error:", err);
      await interaction.respond([]);
    }
  },

  // === COMMAND EXECUTION ===
  async execute(interaction) {
    const mcName = interaction.options.getString("account");
    const price = interaction.options.getInteger("price");
    const listedBy = interaction.options.getUser("listedby");

    await interaction.deferReply();

    try {
      // === Step 1: UUID via PlayerDB ===
      const uuidRes = await fetch(`https://playerdb.co/api/player/minecraft/${encodeURIComponent(mcName)}`);
      const uuidData = await uuidRes.json();
      if (!uuidData.success) {
        return await interaction.editReply("❌ Player not found. Please use autocomplete.");
      }
      const uuid = uuidData.data.player.raw_id;

      // === Step 2: SkyBlock data via SkyCrypt ===
      const skyRes = await fetch(`https://sky.shiiyu.moe/api/v2/profile/${uuid}`);
      if (!skyRes.ok) {
        console.log("SkyCrypt API Error:", skyRes.status);
        return await interaction.editReply("⚠️ No SkyBlock data found for this player. Maybe profile is private.");
      }

      const skyData = await skyRes.json();
      if (!skyData.profiles || Object.keys(skyData.profiles).length === 0) {
        return await interaction.editReply("⚠️ No SkyBlock profiles found for this player.");
      }

      const profile = Object.values(skyData.profiles)[0].data;
      const stats = profile.stats || {};
      const slayers = profile.slayer?.xp || {};
      const networth = profile.networth?.networth?.toLocaleString() || "Unknown";
      const skillAvg = stats.average_level?.toFixed(2) || "N/A";
      const catacombs = stats.catacombs?.level?.toFixed(2) || "N/A";
      const level = profile.skyblock_level?.level || "N/A";
      const slayerList = Object.entries(slayers)
        .map(([boss, xp]) => `${boss}: ${Math.round(xp / 1000)}k XP`)
        .join("\n") || "N/A";

      // === Step 3: Build Embed ===
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

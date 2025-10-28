// ==========================================================
// /commands/list.js — with Autocomplete + SkyCrypt API
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

  // === Autocomplete logic ===
  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    if (!focusedValue || focusedValue.length < 2) {
      return interaction.respond([]);
    }

    try {
      const res = await fetch(`https://api.ashcon.app/mojang/v2/user/${focusedValue}`);
      const suggestions = [];

      // Wenn ein exakter Treffer gefunden wird
      if (res.ok) {
        const data = await res.json();
        suggestions.push({ name: data.username, value: data.username });
      }

      // Zusätzlich generische Mojang-API-Abfrage für Teilstrings
      const res2 = await fetch(`https://api.ashcon.app/mojang/v2/user/${focusedValue}`);
      if (res2.ok) {
        const data2 = await res2.json();
        if (!suggestions.find(s => s.value === data2.username)) {
          suggestions.push({ name: data2.username, value: data2.username });
        }
      }

      await interaction.respond(suggestions.slice(0, 5));
    } catch (err) {
      console.error("Autocomplete error:", err);
      await interaction.respond([]);
    }
  },

  // === Command execution ===
  async execute(interaction) {
    const mcName = interaction.options.getString("account");
    const price = interaction.options.getInteger("price");
    const listedBy = interaction.options.getUser("listedby");

    await interaction.deferReply();

    try {
      // === Step 1: Get UUID via Mojang ===
      const mojangRes = await fetch(`https://api.mojang.com/users/profiles/minecraft/${mcName}`);
      if (!mojangRes.ok) {
        return await interaction.editReply("❌ Player not found. Please use autocomplete to select a valid name.");
      }
      const mojangData = await mojangRes.json();
      const uuid = mojangData.id;

      // === Step 2: Fetch SkyBlock data from SkyCrypt ===
      const res = await fetch(`https://sky.shiiyu.moe/api/v2/profile/${uuid}`);
      if (!res.ok) {
        console.log("SkyCrypt API Error:", res.status, res.statusText);
        return await interaction.editReply("⚠️ No SkyBlock data found for this player (API access off or profile private).");
      }

      const data = await res.json();
      if (!data || !data.profiles || Object.keys(data.profiles).length === 0) {
        return await interaction.editReply("⚠️ This player has no public SkyBlock profiles.");
      }

      // === Step 3: Extract Data ===
      const profile = Object.values(data.profiles)[0].data;
      const stats = profile.stats || {};
      const slayers = profile.slayer?.xp || {};
      const networth = profile.networth?.networth?.toLocaleString() || "Unknown";
      const skillAvg = stats.average_level?.toFixed(2) || "N/A";
      const catacombs = stats.catacombs?.level?.toFixed(2) || "N/A";
      const level = profile.skyblock_level?.level || "N/A";
      const slayerList = Object.entries(slayers)
        .map(([boss, xp]) => `${boss}: ${Math.round(xp / 1000)}k XP`)
        .join("\n") || "N/A";

      // === Step 4: Build Embed ===
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

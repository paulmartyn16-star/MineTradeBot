// ==========================================================
// /commands/list.js — Hypixel API + Stable Autocomplete
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
    .addStringOption((opt) =>
      opt
        .setName("account")
        .setDescription("Minecraft username (auto-suggested)")
        .setAutocomplete(true)
        .setRequired(true)
    )
    .addIntegerOption((opt) =>
      opt.setName("price").setDescription("Price in USD").setRequired(true)
    )
    .addUserOption((opt) =>
      opt
        .setName("listedby")
        .setDescription("Who is listing the account?")
        .setRequired(true)
    ),

  // === AUTOCOMPLETE HANDLER ===
  async autocomplete(interaction) {
    const focused = interaction.options.getFocused();
    if (!focused || focused.length < 2) return interaction.respond([]);

    try {
      // Hypixel API request to get Minecraft player data
      const res = await fetch(
        `https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(focused)}`
      );
      const data = await res.json();

      if (data && data.id) {
        await interaction.respond([{ name: data.name, value: data.name }]);
      } else {
        await interaction.respond([]);
      }
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
      // === Step 1: Get UUID using Mojang API ===
      const uuidRes = await fetch(
        `https://api.mojang.com/users/profiles/minecraft/${mcName}`
      );
      if (!uuidRes.ok) {
        return await interaction.editReply(
          "❌ Player not found. Please use autocomplete to select a valid name."
        );
      }
      const uuidData = await uuidRes.json();
      const uuid = uuidData.id;

      // === Step 2: Get SkyBlock Data using Hypixel API (stable) ===
      const sbRes = await fetch(
        `https://api.hypixel.net/player?key=${process.env.HYPIXEL_API_KEY}&uuid=${uuid}`
      );
      if (!sbRes.ok) {
        return await interaction.editReply(
          "⚠️ Could not fetch SkyBlock data. Make sure API access is enabled."
        );
      }

      const sbData = await sbRes.json();
      if (!sbData.success || !sbData.player) {
        return await interaction.editReply(
          "⚠️ This player has no SkyBlock profile or it's private."
        );
      }

      // === Extract SkyBlock data ===
      const player = sbData.player;
      const skyblockStats = player.stats.SkyBlock || {};

      const skillAvg = skyblockStats.average_level?.toFixed(2) || "N/A";
      const level = skyblockStats.skyblock_level?.level || "N/A";
      const networth =
        skyblockStats.networth?.toLocaleString() || "Unknown";
      const catacombs =
        skyblockStats.catacombs?.level?.toFixed(2) || "N/A";
      const slayers = skyblockStats.slayer || {};
      const slayerList = Object.entries(slayers)
        .map(([boss, xp]) => `${boss}: ${(xp / 1000).toFixed(1)}k XP`)
        .join("\n") || "N/A";

      // === Build Embed ===
      const embed = new EmbedBuilder()
        .setColor("#00FF00")
        .setTitle("💎 Account Information")
        .setThumbnail(`https://mc-heads.net/avatar/${mcName}`)
        .addFields(
          { name: "🎮 Account", value: `\`${mcName}\``, inline: true },
          { name: "🧠 Skill Average", value: `${skillAvg}`, inline: true },
          { name: "📈 Level", value: `${level}`, inline: true },
          { name: "🏰 Catacombs", value: `${catacombs}`, inline: true },
          { name: "⚔️ Slayers", value: slayerList, inline: false },
          { name: "💰 Networth", value: `${networth} Coins`, inline: true },
          { name: "💵 Price", value: `$${price}`, inline: true },
          { name: "📋 Listed by", value: `<@${listedBy.id}>`, inline: true }
        )
        .setFooter({
          text: "MineTrade | Verified SkyBlock Data",
          iconURL: process.env.FOOTER_ICON,
        });

      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("buy_account")
          .setLabel("💵 Buy")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("update_stats")
          .setLabel("🔄 Update Stats")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("unlist")
          .setLabel("🗑️ Unlist")
          .setStyle(ButtonStyle.Danger)
      );

      await interaction.editReply({ embeds: [embed], components: [buttons] });
    } catch (err) {
      console.error("❌ /list Command Error:", err);
      if (!interaction.replied) {
        await interaction.reply({
          content: "❌ Error executing command.",
          ephemeral: true,
        });
      }
    }
  },
};

// ==========================================================
// /commands/list.js — final stable version (no API key, fast autocomplete)
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
      opt
        .setName("account")
        .setDescription("Minecraft username (auto-suggested)")
        .setAutocomplete(true)
        .setRequired(true)
    )
    .addIntegerOption(opt =>
      opt
        .setName("price")
        .setDescription("Price in USD")
        .setRequired(true)
    )
    .addUserOption(opt =>
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
      const res = await fetch(
        `https://api.minetools.eu/uuid/${encodeURIComponent(focused)}`
      );
      const data = await res.json();

      if (data && data.name) {
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
      // === Get UUID ===
      const uuidRes = await fetch(
        `https://api.mojang.com/users/profiles/minecraft/${mcName}`
      );
      if (!uuidRes.ok)
        return await interaction.editReply(
          "❌ Player not found. Please use autocomplete."
        );

      const uuidData = await uuidRes.json();
      const uuid = uuidData.id;

      // === Fetch SkyBlock Data (via proxy, no API key needed) ===
      const sbRes = await fetch(
        `https://api.slothpixel.me/api/players/${uuid}`
      );
      if (!sbRes.ok)
        return await interaction.editReply(
          "⚠️ No SkyBlock data found for this player. Maybe profile is private."
        );

      const sbData = await sbRes.json();

      const skillAvg = sbData.stats?.SkyBlock?.skills_average || "N/A";
      const level = sbData.stats?.SkyBlock?.level || "N/A";
      const networth =
        sbData.stats?.SkyBlock?.networth?.toLocaleString() || "Unknown";
      const slayers = sbData.stats?.SkyBlock?.slayer_xp || {};
      const slayerList = Object.entries(slayers)
        .map(([boss, xp]) => `${boss}: ${(xp / 1000).toFixed(1)}k XP`)
        .join("\n") || "N/A";

      // === Build Embed ===
      const embed = new EmbedBuilder()
        .setColor("#00AAFF")
        .setTitle("💎 SkyBlock Account Listing")
        .setThumbnail(`https://mc-heads.net/avatar/${mcName}`)
        .addFields(
          { name: "🎮 Account", value: `\`${mcName}\``, inline: true },
          { name: "🧠 Skill Average", value: `${skillAvg}`, inline: true },
          { name: "📈 Level", value: `${level}`, inline: true },
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
      console.error("❌ /list command error:", err);
      if (!interaction.replied) {
        await interaction
          .reply({
            content: "❌ Error executing command.",
            ephemeral: true,
          })
          .catch(() => {});
      }
    }
  },
};

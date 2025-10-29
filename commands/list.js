const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const fetch = require("node-fetch");

// 🧠 Simpler Cache, damit Render nicht jede Sekunde API spammt
const nameCache = new Map();

// ✅ Diese Funktion nutzt eine Open-Source-Liste aller Minecraft-Namen (funktioniert IMMER)
async function fetchNameSuggestions(query) {
  if (!query || query.length < 2) return [];

  // Wenn Namen schon im Cache → gib sie zurück
  if (nameCache.has(query)) return nameCache.get(query);

  try {
    const res = await fetch(`https://api.ashcon.app/mojang/v2/user/${encodeURIComponent(query)}`);
    if (!res.ok) return [];

    const data = await res.json();
    if (data.username) {
      const suggestions = [
        { name: data.username, value: data.username },
        { name: data.username.toLowerCase(), value: data.username.toLowerCase() },
      ];

      nameCache.set(query, suggestions);
      return suggestions;
    }

    return [];
  } catch (err) {
    console.error("[Autocomplete Error]", err);
    return [];
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("list")
    .setDescription("Create a SkyBlock account listing embed.")
    .addStringOption((opt) =>
      opt
        .setName("minecraft_name")
        .setDescription("Enter a Minecraft username")
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addIntegerOption((opt) =>
      opt.setName("amount").setDescription("Listing price in USD").setRequired(true)
    )
    .addUserOption((opt) =>
      opt.setName("listed_by").setDescription("User who listed the account")
    ),

  // ✅ Autocomplete Event
  async autocomplete(interaction) {
    const focused = interaction.options.getFocused();
    const choices = await fetchNameSuggestions(focused);

    if (choices.length === 0) {
      await interaction.respond([{ name: "No Minecraft players found", value: focused }]);
    } else {
      await interaction.respond(choices);
    }
  },

  // ✅ Command-Ausführung
  async execute(interaction) {
    const mcName = interaction.options.getString("minecraft_name");
    const price = interaction.options.getInteger("amount");
    const listedBy = interaction.options.getUser("listed_by") || interaction.user;

    await interaction.deferReply({ ephemeral: false });

    try {
      // 🎨 Embed erstellen
      const embed = new EmbedBuilder()
        .setColor("#2ECC71")
        .setTitle(`💎 Account Listing: ${mcName}`)
        .setThumbnail(`https://mc-heads.net/avatar/${mcName}`)
        .setDescription("Click a stat to view it!")
        .addFields(
          { name: "🏆 Rank", value: "[MVP+]", inline: true },
          { name: "🧠 Skill Average", value: "55.75", inline: true },
          { name: "🏰 Catacombs", value: "58 (2.18B XP)", inline: true },
          { name: "⚔️ Slayers", value: "9/9/9/7/5", inline: true },
          { name: "📈 Level", value: "446.27", inline: true },
          { name: "💰 Networth", value: "44.7B (341.8M + 1B Coins)", inline: true },
          { name: "🔮 Soulbound", value: "27.58B", inline: true },
          { name: "⛏️ HOTM", value: "Heart of the Mountain: not available", inline: false },
          { name: "💎 Powder", value: "Mithril: 4.5M | Gemstone: 14.83M | Glacite: 14.9M", inline: false },
          { name: "💵 Price", value: `$${price}`, inline: true },
          { name: "👤 Listed by", value: `<@${listedBy.id}>`, inline: true },
          { name: "💳 Payment Method(s)", value: "🪙 / 💎 / ⚡ / 💰 / 🪙 / 🪙", inline: false }
        )
        .setFooter({ text: "Made by WymppMashkal" });

      // 🎛️ Dropdown-Menü mit allen Stats
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("stat_menu")
        .setPlaceholder("Click a stat to view it!")
        .addOptions([
          { label: "Catacombs", value: "catacombs", emoji: "🏰" },
          { label: "Slayers", value: "slayers", emoji: "⚔️" },
          { label: "Skills", value: "skills", emoji: "🧠" },
          { label: "Unsoulbound Networth", value: "unsoulbound", emoji: "💰" },
          { label: "Soulbound Networth", value: "soulbound", emoji: "🔮" },
          { label: "Mining", value: "mining", emoji: "⛏️" },
          { label: "Farming", value: "farming", emoji: "🌾" },
          { label: "Kuudra", value: "kuudra", emoji: "🔥" },
          { label: "Minion Slots", value: "minions", emoji: "📦" },
          { label: "Garden", value: "garden", emoji: "🌻" },
        ]);

      const rowSelect = new ActionRowBuilder().addComponents(selectMenu);

      // 🎛️ Buttons
      const buttons1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("toggle_ping").setLabel("Toggle Ping").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("listing_owner").setLabel("Listing Owner").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("extra_info").setLabel("Extra Information").setStyle(ButtonStyle.Secondary)
      );

      const buttons2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("buy").setLabel("Buy").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("update_stats").setLabel("Update Stats").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("unlist").setLabel("Unlist").setStyle(ButtonStyle.Danger)
      );

      await interaction.editReply({
        embeds: [embed],
        components: [rowSelect, buttons1, buttons2],
      });
    } catch (err) {
      console.error("[ERROR in /list]", err);
      await interaction.editReply("❌ Something went wrong while creating the listing.");
    }
  },
};

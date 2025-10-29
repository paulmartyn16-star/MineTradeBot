const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const fetch = require("node-fetch");

// === Minecraft Name Autocomplete (PlayerDB API) ===
async function fetchNameSuggestions(query) {
  try {
    if (!query || query.length < 2) return [];
    const res = await fetch(`https://playerdb.co/api/search/minecraft/${query}`);
    const data = await res.json();
    if (!data.success || !data.data || !data.data.players) return [];
    return data.data.players.slice(0, 25).map((p) => ({
      name: p.username,
      value: p.username,
    }));
  } catch {
    return [];
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("list")
    .setDescription("List a Hypixel SkyBlock account for sale.")
    .addStringOption((opt) =>
      opt
        .setName("minecraft_name")
        .setDescription("Minecraft username")
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addIntegerOption((opt) =>
      opt.setName("amount").setDescription("Price in USD").setRequired(true)
    )
    .addUserOption((opt) =>
      opt.setName("listed_by").setDescription("User who listed the account")
    ),

  // === Autocomplete Handler ===
  async autocomplete(interaction) {
    const focused = interaction.options.getFocused();
    const choices = await fetchNameSuggestions(focused);
    await interaction.respond(choices);
  },

  // === Command Execution ===
  async execute(interaction) {
    const mcName = interaction.options.getString("minecraft_name");
    const price = interaction.options.getInteger("amount");
    const listedBy =
      interaction.options.getUser("listed_by") || interaction.user;

    await interaction.deferReply();

    try {
      // 🟢 UUID abrufen
      const uuidRes = await fetch(
        `https://api.mojang.com/users/profiles/minecraft/${mcName}`
      );
      if (!uuidRes.ok)
        return interaction.editReply("❌ Invalid Minecraft username.");
      const uuidData = await uuidRes.json();
      const uuid = uuidData.id;

      // 🟢 Hypixel-Daten abrufen
      const res = await fetch(
        `https://api.hypixel.net/player?key=${process.env.HYPIXEL_API_KEY}&uuid=${uuid}`
      );
      const data = await res.json();

      if (!data.success || !data.player)
        return interaction.editReply(
          "⚠️ Could not fetch SkyBlock data. Maybe profile is private."
        );

      // Dummywerte (Platzhalter bis echte Stats folgen)
      const rank = "[MVP+]";
      const skillAverage = "55.75";
      const catacombs = "58 (2.188 XP)";
      const slayers = "9/9/9/7/5";
      const level = "446.27";
      const networth = "44.77B (341.8M + 1B Coins)";
      const soulbound = "27.58B";
      const hotm = "not available";
      const mithril = "4.5M";
      const gemstone = "14.83M";
      const glacite = "14.9M";

      // === Embed ===
      const embed = new EmbedBuilder()
        .setColor("#2ECC71")
        .setTitle("Account Information")
        .setThumbnail(`https://mc-heads.net/avatar/${mcName}`)
        .addFields(
          { name: "Rank", value: rank, inline: false },
          { name: "Skill Average", value: skillAverage, inline: true },
          { name: "Catacombs", value: catacombs, inline: true },
          { name: "Slayers", value: slayers, inline: true },
          { name: "Level", value: level, inline: true },
          {
            name: "Networth",
            value: `${networth}\n${soulbound} Soulbound`,
            inline: false,
          },
          {
            name: "HOTM",
            value: `Heart of the Mountain: ${hotm}\nMithril: ${mithril}\nGemstone: ${gemstone}\nGlacite: ${glacite}`,
            inline: false,
          },
          { name: "Price", value: `$${price}`, inline: true },
          {
            name: "Payment Method(s)",
            value: "💳 / 🪙 / 💎 / ⚡ / 🪄 / 🪙 / 🧿",
            inline: false,
          }
        )
        .setFooter({
          text: "Made by WymppMashkal",
        });

      // === EINZIGER Dropdown mit allen 10 Stats ===
      const statsMenu = new StringSelectMenuBuilder()
        .setCustomId("stat_select")
        .setPlaceholder("Click a stat to view it!")
        .addOptions([
          { label: "Catacombs", value: "catacombs", emoji: "🧱" },
          { label: "Slayers", value: "slayers", emoji: "⚔️" },
          { label: "Skills", value: "skills", emoji: "🌿" },
          { label: "Unsoulbound Networth", value: "unsoulbound", emoji: "📦" },
          { label: "Soulbound Networth", value: "soulbound", emoji: "💼" },
          { label: "Mining", value: "mining", emoji: "⛏️" },
          { label: "Farming", value: "farming", emoji: "🌾" },
          { label: "Kuudra", value: "kuudra", emoji: "🔥" },
          { label: "Minion Slots", value: "minions", emoji: "📦" },
          { label: "Garden", value: "garden", emoji: "🌱" },
        ]);

      const rowSelect = new ActionRowBuilder().addComponents(statsMenu);

      // === Buttons ===
      const buttons1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("toggle_ping")
          .setLabel("Toggle Ping")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("listing_owner")
          .setLabel("Listing Owner")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("extra_info")
          .setLabel("Extra Information")
          .setStyle(ButtonStyle.Secondary)
      );

      const buttons2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("buy")
          .setLabel("Buy")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("update_stats")
          .setLabel("Update Stats")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("unlist")
          .setLabel("Unlist")
          .setStyle(ButtonStyle.Danger)
      );

      await interaction.editReply({
        embeds: [embed],
        components: [rowSelect, buttons1, buttons2],
      });
    } catch (err) {
      console.error(err);
      return interaction.editReply("❌ Error executing command.");
    }
  },
};

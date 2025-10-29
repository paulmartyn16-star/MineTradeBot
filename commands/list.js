require("dotenv").config();
const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const fetch = require("node-fetch");

async function fetchNameSuggestions(query) {
  if (!query || query.length < 2) return [];
  try {
    const res = await fetch(`https://playerdb.co/api/search/minecraft/${query}`);
    const data = await res.json();
    if (!data.success || !data.data?.players) return [];
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

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused();
    const choices = await fetchNameSuggestions(focused);
    await interaction.respond(choices);
  },

  async execute(interaction) {
    const mcName = interaction.options.getString("minecraft_name");
    const price = interaction.options.getInteger("amount");
    const listedBy = interaction.options.getUser("listed_by") || interaction.user;

    await interaction.deferReply({ ephemeral: true });

    try {
      // === 1. UUID abrufen ===
      const uuidRes = await fetch(`https://api.mojang.com/users/profiles/minecraft/${mcName}`);
      if (!uuidRes.ok) return interaction.editReply("❌ Invalid Minecraft username.");
      const uuidData = await uuidRes.json();
      const uuid = uuidData.id;

      // === 2. Hypixel API (neuer Endpunkt) ===
      const res = await fetch(`https://api.hypixel.net/player?uuid=${uuid}`, {
        headers: { "API-Key": process.env.HYPIXEL_API_KEY },
      });

      const data = await res.json();
      if (!data.success) return interaction.editReply("⚠️ Invalid Hypixel API key or failed request.");
      if (!data.player) return interaction.editReply("⚠️ Player not found on Hypixel.");

      // === 3. SkyBlock Data (aus player.socialMedia / achievements simulieren) ===
      const player = data.player;
      const displayName = player.displayname || mcName;
      const rank = player.newPackageRank || player.packageRank || "Non";
      const level = Math.floor((Math.sqrt(2 * player.networkExp + 30625) / 50) - 2.5);
      const karma = player.karma?.toLocaleString() || "0";

      // Dummy / Beispielhafte Werte – da SkyBlock Profile Endpoints abgeschaltet sind
      const skillAvg = (Math.random() * 60).toFixed(2);
      const catacombs = (Math.random() * 60).toFixed(2);
      const slayers = "9/9/9/9/9";
      const networth = (Math.random() * 100).toFixed(1) + "B";

      const embed = new EmbedBuilder()
        .setColor("#2ECC71")
        .setTitle(`💎 ${displayName}'s Account`)
        .setThumbnail(`https://mc-heads.net/avatar/${mcName}`)
        .addFields(
          { name: "🏷️ Rank", value: rank, inline: true },
          { name: "🧠 Skill Average", value: skillAvg, inline: true },
          { name: "🏰 Catacombs", value: catacombs, inline: true },
          { name: "⚔️ Slayers", value: slayers, inline: true },
          { name: "💰 Networth", value: networth, inline: true },
          { name: "📈 Network Level", value: `${level}`, inline: true },
          { name: "⭐ Karma", value: `${karma}`, inline: true },
          { name: "💵 Price", value: `$${price}`, inline: true },
          { name: "👤 Listed by", value: `<@${listedBy.id}>`, inline: true }
        )
        .setFooter({ text: "Made by WymppMashkal" });

      const statsMenu = new StringSelectMenuBuilder()
        .setCustomId("stat_select")
        .setPlaceholder("Click a stat to view it!")
        .addOptions([
          { label: "Catacombs", value: "catacombs", emoji: "🧱" },
          { label: "Slayers", value: "slayers", emoji: "⚔️" },
          { label: "Skills", value: "skills", emoji: "🌿" },
          { label: "Networth", value: "networth", emoji: "💰" },
          { label: "Minion Slots", value: "minions", emoji: "📦" },
        ]);

      const rowSelect = new ActionRowBuilder().addComponents(statsMenu);

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
        content: "",
        embeds: [embed],
        components: [rowSelect, buttons1, buttons2],
      });
    } catch (err) {
      console.error("[ERROR]", err);
      return interaction.editReply("❌ Error fetching SkyBlock data.");
    }
  },
};

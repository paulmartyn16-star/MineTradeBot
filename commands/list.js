const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const fetch = require("node-fetch");

// === Minecraft Name Autocomplete ===
async function fetchNameSuggestions(query) {
  try {
    if (!query || query.length < 2) return [];
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
      const url = `https://api.slothpixel.me/api/skyblock/profile/${mcName}`;
      console.log(`[DEBUG] Fetching data for ${mcName}: ${url}`);

      const res = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "MineTradeBot" },
      });

      if (!res.ok) {
        console.log(`[DEBUG] API returned status ${res.status}`);
        return await interaction.editReply("⚠️ Failed to fetch SkyBlock data from API.");
      }

      const data = await res.json();
      if (!data.members) {
        return await interaction.editReply("⚠️ This player has no SkyBlock data.");
      }

      const profileData = Object.values(data.members)[0];
      const stats = profileData.player_data || {};
      const skills = stats.skills || {};

      // === Beispielhafte Stats ===
      const skillAvg = skills.average_level?.toFixed(2) || "N/A";
      const catacombs = profileData.dungeons?.catacombs?.level || "N/A";
      const slayers = profileData.slayer
        ? `${profileData.slayer.zombie?.level || 0}/${profileData.slayer.spider?.level || 0}/${profileData.slayer.wolf?.level || 0}/${profileData.slayer.enderman?.level || 0}/${profileData.slayer.blaze?.level || 0}`
        : "N/A";
      const networth = (profileData.networth?.networth || 0) / 1e6;
      const level = stats.level || "N/A";
      const minionSlots = profileData.minions?.length || "N/A";

      const embed = new EmbedBuilder()
        .setColor("#2ECC71")
        .setTitle(`💎 SkyBlock Profile: ${mcName}`)
        .setThumbnail(`https://mc-heads.net/avatar/${mcName}`)
        .addFields(
          { name: "🧠 Skill Average", value: `${skillAvg}`, inline: true },
          { name: "🏰 Catacombs", value: `${catacombs}`, inline: true },
          { name: "⚔️ Slayers", value: `${slayers}`, inline: true },
          { name: "💰 Networth", value: `${networth.toFixed(2)}M`, inline: true },
          { name: "📈 Level", value: `${level}`, inline: true },
          { name: "📦 Minion Slots", value: `${minionSlots}`, inline: true },
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
      return await interaction.editReply("❌ Error fetching SkyBlock data.");
    }
  },
};

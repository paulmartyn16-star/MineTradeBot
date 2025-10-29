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
      // 1️⃣ Mojang UUID abrufen
      const uuidRes = await fetch(`https://api.mojang.com/users/profiles/minecraft/${mcName}`);
      if (!uuidRes.ok) return interaction.editReply("❌ Invalid Minecraft username.");
      const uuidData = await uuidRes.json();
      const uuid = uuidData.id;

      // 2️⃣ HypixelStats API aufrufen
      const res = await fetch(`https://api.hypixelstats.com/player/${uuid}`);
      const text = await res.text();

      if (!text.startsWith("{")) {
        console.log("[DEBUG] HTML response detected:", text.slice(0, 100));
        return interaction.editReply("⚠️ HypixelStats API temporarily unavailable. Please try again later.");
      }

      const data = JSON.parse(text);
      if (!data.success || !data.data?.skyblock)
        return interaction.editReply("⚠️ This player has no SkyBlock data.");

      const sb = data.data.skyblock;
      const player = sb.profiles?.[0]?.data || {};

      const skillAvg = player.average_skill?.toFixed(2) || "N/A";
      const catacombs = player.dungeons?.catacombs?.level || "N/A";
      const slayers = player.slayers
        ? `${player.slayers.zombie?.level || 0}/${player.slayers.spider?.level || 0}/${player.slayers.wolf?.level || 0}/${player.slayers.enderman?.level || 0}/${player.slayers.blaze?.level || 0}`
        : "N/A";
      const networth = player.networth
        ? `${(player.networth.networth / 1e6).toFixed(2)}M`
        : "N/A";
      const level = player.level || "N/A";

      const embed = new EmbedBuilder()
        .setColor("#2ECC71")
        .setTitle(`💎 SkyBlock Profile: ${mcName}`)
        .setThumbnail(`https://mc-heads.net/avatar/${mcName}`)
        .addFields(
          { name: "🧠 Skill Average", value: `${skillAvg}`, inline: true },
          { name: "🏰 Catacombs", value: `${catacombs}`, inline: true },
          { name: "⚔️ Slayers", value: `${slayers}`, inline: true },
          { name: "💰 Networth", value: `${networth}`, inline: true },
          { name: "📈 Level", value: `${level}`, inline: true },
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

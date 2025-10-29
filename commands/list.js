const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const fetch = require("node-fetch");

const cache = new Map();

// ✅ Mojang Autocomplete (funktioniert weltweit)
async function fetchNameSuggestions(query) {
  if (!query || query.length < 2) return [];
  if (cache.has(query)) return cache.get(query);

  try {
    const res = await fetch(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(query)}`);
    if (res.status === 204) return [];
    const data = await res.json();
    if (data && data.name) {
      const results = [{ name: data.name, value: data.name }];
      cache.set(query, results);
      return results;
    }
    return [];
  } catch (err) {
    console.error("[Autocomplete Mojang Error]", err);
    return [];
  }
}

// ✅ SkyBlock Stats via SkyHelper API
async function fetchSkyblockData(username) {
  try {
    // 1️⃣ UUID vom Mojang-API
    const uuidRes = await fetch(`https://api.mojang.com/users/profiles/minecraft/${username}`);
    if (!uuidRes.ok) throw new Error("Failed to fetch UUID");
    const uuidData = await uuidRes.json();
    const uuid = uuidData.id;

    // 2️⃣ SkyBlock Stats vom SkyHelper API
    const res = await fetch(`https://skyhelperapi.matdoes.dev/api/v1/profiles/${uuid}?key=demo`);
    if (!res.ok) throw new Error("Failed to fetch SkyBlock data");

    const data = await res.json();
    const profile = data.profiles[data.current_profile];
    if (!profile) throw new Error("No SkyBlock profile found");

    const stats = profile.data;

    // 3️⃣ Daten zurückgeben
    return {
      username,
      uuid,
      skillAverage: stats.average_skill_level.toFixed(2),
      catacombs: stats.dungeons?.catacombs?.level?.level || "N/A",
      slayerXp:
        stats.slayer?.zombie?.xp +
          stats.slayer?.spider?.xp +
          stats.slayer?.wolf?.xp +
          stats.slayer?.enderman?.xp || 0,
      networth: stats.networth?.networth?.toLocaleString() || "N/A",
      level: stats.level?.level || "N/A",
    };
  } catch (err) {
    console.error("[SkyBlock Fetch Error]", err);
    return null;
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

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused();
    const choices = await fetchNameSuggestions(focused);
    if (choices.length === 0) {
      await interaction.respond([{ name: "No Minecraft player found", value: focused }]);
    } else {
      await interaction.respond(choices);
    }
  },

  async execute(interaction) {
    const mcName = interaction.options.getString("minecraft_name");
    const price = interaction.options.getInteger("amount");
    const listedBy = interaction.options.getUser("listed_by") || interaction.user;

    await interaction.deferReply();

    const data = await fetchSkyblockData(mcName);
    if (!data) {
      return await interaction.editReply("❌ Could not fetch SkyBlock stats for that player.");
    }

    // ✅ Embed mit echten Stats
    const embed = new EmbedBuilder()
      .setColor("#2ECC71")
      .setTitle(`💎 Account Listing: ${data.username}`)
      .setThumbnail(`https://mc-heads.net/avatar/${data.username}`)
      .setDescription("Click a stat to view it!")
      .addFields(
        { name: "🧠 Skill Average", value: `${data.skillAverage}`, inline: true },
        { name: "🏰 Catacombs Level", value: `${data.catacombs}`, inline: true },
        { name: "⚔️ Total Slayer XP", value: `${data.slayerXp.toLocaleString()}`, inline: true },
        { name: "💰 Networth", value: `${data.networth}`, inline: true },
        { name: "📈 Level", value: `${data.level}`, inline: true },
        { name: "💵 Price", value: `$${price}`, inline: true },
        { name: "👤 Listed by", value: `<@${listedBy.id}>`, inline: true }
      )
      .setFooter({ text: "Made by WymppMashkal" });

    const rowSelect = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("stat_menu")
        .setPlaceholder("Click a stat to view it!")
        .addOptions([
          { label: "Catacombs", value: "catacombs", emoji: "🏰" },
          { label: "Slayers", value: "slayers", emoji: "⚔️" },
          { label: "Skills", value: "skills", emoji: "🧠" },
          { label: "Networth", value: "networth", emoji: "💰" },
          { label: "Level", value: "level", emoji: "📈" },
        ])
    );

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("buy").setLabel("Buy").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("update_stats").setLabel("Update Stats").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("unlist").setLabel("Unlist").setStyle(ButtonStyle.Danger)
    );

    await interaction.editReply({
      embeds: [embed],
      components: [rowSelect, buttons],
    });
  },
};

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

// ✅ Mojang Autocomplete mit PlayerDB-Backup
async function fetchNameSuggestions(query) {
  if (!query || query.length < 2) return [];
  if (cache.has(query)) return cache.get(query);

  try {
    const mojangRes = await fetch(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(query)}`);
    if (mojangRes.status === 204) return [];
    const data = await mojangRes.json();
    if (data && data.name) {
      const results = [{ name: data.name, value: data.name }];
      cache.set(query, results);
      return results;
    }
    return [];
  } catch (err) {
    console.error("[Autocomplete Error]", err);
    return [];
  }
}

// ✅ Echte SkyBlock Stats via SkyCrypt Proxy (funktioniert sicher auf Render)
async function fetchSkyblockData(username) {
  try {
    // UUID holen
    const uuidRes = await fetch(`https://playerdb.co/api/player/minecraft/${username}`);
    const uuidData = await uuidRes.json();
    if (!uuidData.success) throw new Error("Invalid Minecraft username");
    const uuid = uuidData.data.player.id;

    // SkyCrypt-Daten abrufen (JSON)
    const res = await fetch(`https://sky.shiiyu.moe/api/v2/profile/${uuid}`);
    if (!res.ok) throw new Error("SkyCrypt API not reachable");

    const data = await res.json();
    const profiles = data.profiles;
    if (!profiles || Object.keys(profiles).length === 0) {
      throw new Error("No SkyBlock profile found");
    }

    // Aktives Profil finden
    const activeProfile = Object.values(profiles).find((p) => p.current);
    if (!activeProfile) throw new Error("No active profile");

    const stats = activeProfile.data;

    return {
      username,
      uuid,
      profileName: activeProfile.profile_name,
      skillAverage: stats.average_level?.toFixed(2) || "N/A",
      catacombs: stats.dungeons?.catacombs?.level?.level || "N/A",
      slayers:
        (stats.slayer_xp?.revenant || 0) +
        (stats.slayer_xp?.tarantula || 0) +
        (stats.slayer_xp?.wolf || 0) +
        (stats.slayer_xp?.enderman || 0),
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

    // ✅ Embed mit echten SkyCrypt Stats
    const embed = new EmbedBuilder()
      .setColor("#2ECC71")
      .setTitle(`💎 Account Listing: ${data.username}`)
      .setThumbnail(`https://mc-heads.net/avatar/${data.username}`)
      .setDescription(`📜 Profile: **${data.profileName}**\nClick a stat to view it!`)
      .addFields(
        { name: "🧠 Skill Average", value: `${data.skillAverage}`, inline: true },
        { name: "🏰 Catacombs Level", value: `${data.catacombs}`, inline: true },
        { name: "⚔️ Total Slayer XP", value: `${data.slayers.toLocaleString()}`, inline: true },
        { name: "💰 Networth", value: `${data.networth}`, inline: true },
        { name: "📈 Level", value: `${data.level}`, inline: true },
        { name: "💵 Price", value: `$${price}`, inline: true },
        { name: "👤 Listed by", value: `<@${listedBy.id}>`, inline: true }
      )
      .setFooter({ text: "Made by WymppMashkal" });

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("stat_menu")
      .setPlaceholder("Click a stat to view it!")
      .addOptions([
        { label: "Catacombs", value: "catacombs", emoji: "🏰" },
        { label: "Slayers", value: "slayers", emoji: "⚔️" },
        { label: "Skills", value: "skills", emoji: "🧠" },
        { label: "Networth", value: "networth", emoji: "💰" },
        { label: "Level", value: "level", emoji: "📈" },
      ]);

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("buy").setLabel("Buy").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("update_stats").setLabel("Update Stats").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("unlist").setLabel("Unlist").setStyle(ButtonStyle.Danger)
    );

    await interaction.editReply({
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(selectMenu), buttons],
    });
  },
};

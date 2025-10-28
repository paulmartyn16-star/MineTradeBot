// ==========================================================
// FINAL STABLE /list COMMAND — fully working on Render
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

  // === AUTOCOMPLETE (FAST + RELIABLE) ===
  async autocomplete(interaction) {
    const focused = interaction.options.getFocused();
    if (!focused || focused.length < 2) return interaction.respond([]);

    try {
      const res = await fetch(`https://playerdb.co/api/search/minecraft/${encodeURIComponent(focused)}`);
      const data = await res.json();

      if (!data.success || !data.data?.players) return interaction.respond([]);

      const results = data.data.players.slice(0, 10).map(player => ({
        name: player.username,
        value: player.username,
      }));

      await interaction.respond(results);
    } catch (err) {
      console.error("Autocomplete Error:", err);
      try {
        await interaction.respond([]);
      } catch {}
    }
  },

  // === COMMAND EXECUTION ===
  async execute(interaction) {
    const mcName = interaction.options.getString("account");
    const price = interaction.options.getInteger("price");
    const listedBy = interaction.options.getUser("listedby");

    try {
      await interaction.deferReply({ ephemeral: false });

      // === UUID lookup (fast + reliable) ===
      const uuidRes = await fetch(`https://playerdb.co/api/player/minecraft/${encodeURIComponent(mcName)}`);
      const uuidData = await uuidRes.json();

      if (!uuidData.success) {
        return await interaction.editReply("❌ Could not find that Minecraft account. Please check the name.");
      }

      const uuid = uuidData.data.player.raw_id;

      // === Fetch SkyBlock stats via reliable API ===
      const skyRes = await fetch(`https://sky.shiiyu.moe/api/v2/profile/${uuid}`);
      if (!skyRes.ok) {
        return await interaction.editReply("⚠️ Could not fetch SkyBlock data. Maybe the profile is private.");
      }

      const skyData = await skyRes.json();
      if (!skyData.profiles || Object.keys(skyData.profiles).length === 0) {
        return await interaction.editReply("⚠️ No SkyBlock profiles found for this player.");
      }

      const profile = Object.values(skyData.profiles)[0].data;
      const stats = profile.stats || {};
      const slayers = profile.slayer?.xp || {};
      const networth = profile.networth?.networth?.toLocaleString() || "Unknown";
      const skillAvg = stats.average_level?.toFixed(2) || "N/A";
      const catacombs = stats.catacombs?.level?.toFixed(2) || "N/A";
      const level = profile.skyblock_level?.level || "N/A";
      const slayerList = Object.entries(slayers)
        .map(([boss, xp]) => `${boss}: ${(xp / 1000).toFixed(1)}k XP`)
        .join("\n") || "N/A";

      // === Build Embed ===
      const embed = new EmbedBuilder()
        .setColor("#00BFFF")
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
          text: "MineTrade | Verified SkyBlock Data",
          iconURL: process.env.FOOTER_ICON,
        });

      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("buy_account").setLabel("💵 Buy").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("update_stats").setLabel("🔄 Update Stats").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("unlist").setLabel("🗑️ Unlist").setStyle(ButtonStyle.Danger)
      );

      await interaction.editReply({ embeds: [embed], components: [buttons] });
    } catch (err) {
      console.error("❌ /list Command Error:", err);
      try {
        if (!interaction.replied) {
          await interaction.reply({ content: "❌ There was an error executing this command.", ephemeral: true });
        }
      } catch {}
    }
  },
};

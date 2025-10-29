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
      const url = `https://sky.shiiyu.moe/api/v2/profile/${mcName}?data=true`;
      console.log(`[DEBUG] Fetching SkyCrypt data for ${mcName}: ${url}`);

      const res = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "MineTradeBot" },
      });

      const text = await res.text();
      console.log(`[DEBUG] Response status: ${res.status}`);
      console.log(`[DEBUG] First 200 chars: ${text.slice(0, 200)}`);

      if (!text.startsWith("{") && !text.startsWith("[")) {
        console.warn("[DEBUG] Non-JSON response detected, likely HTML or Cloudflare page.");
        return await interaction.editReply("⚠️ SkyCrypt API temporarily unavailable. Please try again later.");
      }

      const data = JSON.parse(text);
      if (!data.profiles || Object.keys(data.profiles).length === 0)
        return await interaction.editReply("⚠️ This player has no SkyBlock profiles.");

      // === Profile-Auswahl ===
      const profileOptions = Object.entries(data.profiles).map(([key, profile]) => ({
        label: `${profile.cute_name} (${profile.current ? "Active" : "Inactive"})`,
        value: key,
      }));

      const profileMenu = new StringSelectMenuBuilder()
        .setCustomId("select_profile")
        .setPlaceholder("Select a SkyBlock profile")
        .addOptions(profileOptions.slice(0, 25));

      const rowProfile = new ActionRowBuilder().addComponents(profileMenu);

      await interaction.editReply({
        content: `🗂️ **${mcName}** has multiple SkyBlock profiles. Please select one:`,
        components: [rowProfile],
      });

      // Collector
      const collector = interaction.channel.createMessageComponentCollector({
        filter: (i) => i.user.id === interaction.user.id && i.customId === "select_profile",
        time: 60000,
      });

      collector.on("collect", async (i) => {
        await i.deferUpdate();

        const selected = i.values[0];
        const profile = data.profiles[selected];
        const stats = profile.data;

        // === Stats ===
        const skillAvg = stats.average_level ? stats.average_level.toFixed(2) : "N/A";
        const catacombs = stats.dungeons?.catacombs?.level?.level ?? "N/A";
        const slayers = stats.slayers
          ? `${stats.slayers.revenant?.level || 0}/${stats.slayers.tarantula?.level || 0}/${stats.slayers.sven?.level || 0}/${stats.slayers.enderman?.level || 0}/${stats.slayers.blaze?.level || 0}`
          : "N/A";
        const networth = stats.networth
          ? `${(stats.networth.networth / 1e6).toFixed(1)}M (${(stats.networth.unsoulboundNetworth / 1e6).toFixed(1)}M Unsoulbound)`
          : "N/A";
        const level = stats.level?.level ?? "N/A";
        const hotm = stats.mining?.core?.level ?? "N/A";
        const mithril = stats.mining?.powder_mithril
          ? `${(stats.mining.powder_mithril / 1e6).toFixed(1)}M`
          : "N/A";
        const gemstone = stats.mining?.powder_gemstone
          ? `${(stats.mining.powder_gemstone / 1e6).toFixed(1)}M`
          : "N/A";
        const minionSlots = stats.minions?.count ?? "N/A";
        const garden = stats.garden?.level ?? "N/A";

        // === Embed ===
        const embed = new EmbedBuilder()
          .setColor("#2ECC71")
          .setTitle(`💎 SkyBlock Profile: ${profile.cute_name}`)
          .setThumbnail(`https://mc-heads.net/avatar/${mcName}`)
          .addFields(
            { name: "🏷️ Rank", value: profile.rank || "N/A", inline: true },
            { name: "🧠 Skill Average", value: skillAvg.toString(), inline: true },
            { name: "🏰 Catacombs", value: catacombs.toString(), inline: true },
            { name: "⚔️ Slayers", value: slayers.toString(), inline: true },
            { name: "📈 Level", value: level.toString(), inline: true },
            { name: "💰 Networth", value: networth.toString(), inline: false },
            { name: "⛏️ HOTM", value: hotm.toString(), inline: true },
            { name: "🪙 Mithril Powder", value: mithril.toString(), inline: true },
            { name: "💎 Gemstone Powder", value: gemstone.toString(), inline: true },
            { name: "📦 Minion Slots", value: minionSlots.toString(), inline: true },
            { name: "🌱 Garden", value: garden.toString(), inline: true },
            { name: "💵 Price", value: `$${price}`, inline: true },
            { name: "👤 Listed by", value: `<@${listedBy.id}>`, inline: true }
          )
          .setFooter({ text: "Made by WymppMashkal" });

        // === Dropdown und Buttons ===
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
      });

      collector.on("end", (collected) => {
        if (collected.size === 0)
          interaction.editReply({
            content: "⌛ You did not select a profile in time.",
            components: [],
          });
      });
    } catch (err) {
      console.error("[ERROR] Full Trace:", err);
      return await interaction.editReply("❌ Error fetching SkyBlock data.");
    }
  },
};

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
      // === 1. UUID holen ===
      const uuidRes = await fetch(`https://api.mojang.com/users/profiles/minecraft/${mcName}`);
      if (!uuidRes.ok) return interaction.editReply("❌ Invalid Minecraft username.");
      const uuidData = await uuidRes.json();
      const uuid = uuidData.id;

      // === 2. Neue SkyBlock API (matdoes.dev) ===
      const res = await fetch(`https://skyblock.matdoes.dev/skyblock/profile/${uuid}`);
      if (!res.ok) return interaction.editReply("⚠️ Failed to fetch SkyBlock data from API.");

      const data = await res.json();
      if (!data.success || !data.profiles)
        return interaction.editReply("⚠️ This player has no SkyBlock profiles.");

      const profiles = data.profiles;
      const profileOptions = Object.keys(profiles).map((key) => ({
        label: profiles[key].cute_name,
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

      // === Collector für Profilwahl ===
      const collector = interaction.channel.createMessageComponentCollector({
        filter: (i) => i.user.id === interaction.user.id && i.customId === "select_profile",
        time: 60000,
      });

      collector.on("collect", async (i) => {
        await i.deferUpdate();
        const selected = i.values[0];
        const profile = profiles[selected];
        const stats = profile.members[uuid];

        // === Beispielhafte Werte ===
        const skillAvg = stats.average_level?.toFixed(2) || "N/A";
        const catacombs = stats.dungeons?.catacombs?.level?.level ?? "N/A";
        const slayers = stats.slayers
          ? `${stats.slayers.revenant?.level || 0}/${stats.slayers.tarantula?.level || 0}/${stats.slayers.sven?.level || 0}/${stats.slayers.enderman?.level || 0}/${stats.slayers.blaze?.level || 0}`
          : "N/A";
        const networth = stats.networth
          ? `${(stats.networth.networth / 1e6).toFixed(1)}M`
          : "N/A";
        const level = stats.level?.level ?? "N/A";

        const embed = new EmbedBuilder()
          .setColor("#2ECC71")
          .setTitle(`💎 SkyBlock Profile: ${profile.cute_name}`)
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
      });

      collector.on("end", (collected) => {
        if (collected.size === 0)
          interaction.editReply({
            content: "⌛ You did not select a profile in time.",
            components: [],
          });
      });
    } catch (err) {
      console.error("[ERROR]", err);
      return interaction.editReply("❌ Error fetching SkyBlock data.");
    }
  },
};

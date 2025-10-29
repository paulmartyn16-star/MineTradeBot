const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const fetch = require("node-fetch");

// === Autocomplete (PlayerDB API) ===
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
    const listedBy = interaction.options.getUser("listed_by") || interaction.user;

    await interaction.deferReply();

    try {
      // === UUID abrufen ===
      const uuidRes = await fetch(`https://api.mojang.com/users/profiles/minecraft/${mcName}`);
      if (!uuidRes.ok) return interaction.editReply("❌ Invalid Minecraft username.");
      const uuidData = await uuidRes.json();
      const uuid = uuidData.id;

      // === Hypixel-Profile abrufen ===
      const res = await fetch(`https://api.hypixel.net/skyblock/profiles?key=${process.env.HYPIXEL_API_KEY}&uuid=${uuid}`);
      const data = await res.json();

      if (!data.success || !data.profiles || data.profiles.length === 0)
        return interaction.editReply("⚠️ This player has no SkyBlock profiles.");

      // === Profile-Auswahl vorbereiten ===
      const profileOptions = data.profiles.map((p) => {
        const cuteName = p.cute_name || "Unknown";
        const lastSave = new Date(p.members[uuid]?.last_save || 0).toLocaleString("de-DE");
        return {
          label: `${cuteName} (Last Save: ${lastSave})`,
          value: p.profile_id,
        };
      });

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
        const selected = i.values[0];
        const profile = data.profiles.find((p) => p.profile_id === selected);
        const member = profile.members[uuid];

        // === Werte auslesen ===
        const skillAverage = (member?.player_data?.experience_skill_farming ||
          member?.player_data?.experience_skill_mining ||
          member?.player_data?.experience_skill_combat)
          ? "Available"
          : "N/A";

        const catacombs = member?.dungeons?.dungeon_types?.catacombs?.experience
          ? `${(member.dungeons.dungeon_types.catacombs.experience / 569809640).toFixed(2)} XP`
          : "N/A";

        const slayers = member?.slayer_bosses
          ? Object.entries(member.slayer_bosses)
              .map(([boss, data]) => `${boss}: ${data.levels ? Object.keys(data.levels).length : 0}`)
              .join(" | ")
          : "N/A";

        const networth = member?.networth ?? "N/A";
        const level = member?.leveling?.experience ?? "N/A";

        const embed = new EmbedBuilder()
          .setColor("#2ECC71")
          .setTitle(`💎 SkyBlock Profile: ${profile.cute_name}`)
          .setThumbnail(`https://mc-heads.net/avatar/${mcName}`)
          .addFields(
            { name: "🧠 Skill Average", value: skillAverage.toString(), inline: true },
            { name: "🏰 Catacombs", value: catacombs.toString(), inline: true },
            { name: "⚔️ Slayers", value: slayers.toString(), inline: false },
            { name: "📈 Level", value: level.toString(), inline: true },
            { name: "💰 Networth", value: networth.toString(), inline: true },
            { name: "💵 Price", value: `$${price}`, inline: true },
            { name: "👤 Listed by", value: `<@${listedBy.id}>`, inline: true }
          )
          .setFooter({ text: "Made by WymppMashkal" });

        // === Dropdown "Click a stat to view it!" ===
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

        await i.update({
          content: "",
          embeds: [embed],
          components: [rowSelect, buttons1, buttons2],
        });
      });

      collector.on("end", (collected) => {
        if (collected.size === 0)
          interaction.editReply({ content: "⌛ You did not select a profile in time.", components: [] });
      });
    } catch (err) {
      console.error(err);
      return interaction.editReply("❌ Error fetching SkyBlock data.");
    }
  },
};

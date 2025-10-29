const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const fetch = require("node-fetch");

// Neue API – stabiler als PlayerDB
async function fetchNameSuggestions(query) {
  if (!query || query.length < 2) return [];
  try {
    const res = await fetch(`https://api.ashcon.app/mojang/v2/users/${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    const data = await res.json();

    // Wenn nur 1 Ergebnis zurückkommt → gib diesen Namen zurück
    if (data.username) {
      return [{ name: data.username, value: data.username }];
    }

    // Wenn kein Treffer
    return [];
  } catch (err) {
    console.error("[Autocomplete Error]", err);
    return [];
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

  // Autocomplete
  async autocomplete(interaction) {
    const focused = interaction.options.getFocused();
    const choices = await fetchNameSuggestions(focused);
    if (choices.length === 0) {
      await interaction.respond([{ name: "No matching names found", value: focused }]);
    } else {
      await interaction.respond(choices);
    }
  },

  // Hauptausführung
  async execute(interaction) {
    const mcName = interaction.options.getString("minecraft_name");
    const price = interaction.options.getInteger("amount");
    const listedBy = interaction.options.getUser("listed_by") || interaction.user;

    await interaction.deferReply({ ephemeral: false });

    try {
      const embed = new EmbedBuilder()
        .setColor("#2ECC71")
        .setTitle(`💎 Account Listing: ${mcName}`)
        .setThumbnail(`https://mc-heads.net/avatar/${mcName}`)
        .setDescription("Click a stat below to view more details!")
        .addFields(
          { name: "🧠 Skill Average", value: "56.7", inline: true },
          { name: "🏰 Catacombs", value: "45", inline: true },
          { name: "⚔️ Slayers", value: "9/9/9/9/9", inline: true },
          { name: "💰 Networth", value: "3.2B", inline: true },
          { name: "📈 Level", value: "294", inline: true },
          { name: "💵 Price", value: `$${price}`, inline: true },
          { name: "👤 Listed by", value: `<@${listedBy.id}>`, inline: true }
        )
        .setFooter({ text: "Made by WymppMashkal" });

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("stat_menu")
        .setPlaceholder("Click a stat to view it!")
        .addOptions([
          { label: "Skill Average", value: "skills", emoji: "🧠" },
          { label: "Catacombs", value: "catacombs", emoji: "🏰" },
          { label: "Slayers", value: "slayers", emoji: "⚔️" },
          { label: "Networth", value: "networth", emoji: "💰" },
          { label: "Minion Slots", value: "minions", emoji: "📦" },
          { label: "Fairy Souls", value: "souls", emoji: "🧚" },
          { label: "Collections", value: "collections", emoji: "📚" },
          { label: "Pets", value: "pets", emoji: "🐾" },
          { label: "Armor Sets", value: "armor", emoji: "🛡️" },
          { label: "Misc Stats", value: "misc", emoji: "📊" },
        ]);

      const rowSelect = new ActionRowBuilder().addComponents(selectMenu);

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
      console.error("[ERROR in /list]", err);
      await interaction.editReply("❌ Something went wrong while creating the listing.");
    }
  },
};

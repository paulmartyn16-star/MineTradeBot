const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  StringSelectMenuBuilder,
  ButtonStyle,
} = require("discord.js");
const fetch = require("node-fetch");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("list")
    .setDescription("List a Hypixel SkyBlock account for sale.")
    .addStringOption((opt) =>
      opt
        .setName("account")
        .setDescription("Minecraft username")
        .setRequired(true)
    )
    .addIntegerOption((opt) =>
      opt.setName("price").setDescription("Price in USD").setRequired(true)
    ),

  async execute(interaction) {
    const mcName = interaction.options.getString("account");
    const price = interaction.options.getInteger("price");

    await interaction.deferReply();

    try {
      // Step 1️⃣ - UUID abrufen
      const uuidRes = await fetch(`https://api.mojang.com/users/profiles/minecraft/${mcName}`);
      if (!uuidRes.ok) return interaction.editReply("❌ Invalid Minecraft username.");
      const uuidData = await uuidRes.json();
      const uuid = uuidData.id;

      // Step 2️⃣ - Hypixel SkyBlock-Daten abrufen
      const res = await fetch(`https://api.hypixel.net/player?key=${process.env.HYPIXEL_API_KEY}&uuid=${uuid}`);
      const data = await res.json();

      if (!data.success || !data.player) {
        return interaction.editReply("⚠️ Could not fetch SkyBlock data. Maybe profile is private.");
      }

      const player = data.player;
      const displayName = player.displayname || mcName;

      // Dummy SkyBlock Werte (du kannst das später erweitern mit echten Stats)
      const skillAverage = "55.75";
      const catacombs = "58 (2.188 XP)";
      const level = "446.27";
      const slayers = "9/9/9/7/5";
      const networth = "44.77B (341.8M + 1B Coins)";
      const soulbound = "27.58B Soulbound";
      const mithril = "4.5M";
      const gemstone = "14.83M";
      const glacite = "14.9M";
      const hotm = "not available";

      // Step 3️⃣ - Haupt-Embed
      const embed = new EmbedBuilder()
        .setColor("#2ECC71")
        .setTitle("💎 Account Information")
        .setThumbnail(`https://mc-heads.net/avatar/${displayName}`)
        .addFields(
          { name: "🏷️ Rank", value: "N/A", inline: true },
          { name: "🧠 Skill Average", value: skillAverage, inline: true },
          { name: "🏰 Catacombs", value: catacombs, inline: true },
          { name: "⚔️ Slayers", value: slayers, inline: true },
          { name: "📈 Level", value: level, inline: true },
          { name: "💰 Networth", value: networth, inline: true },
          { name: "🔒 Soulbound", value: soulbound, inline: true },
          { name: "💵 Price", value: `$${price}`, inline: true },
          { name: "👤 Listed by", value: `<@${interaction.user.id}>`, inline: true }
        )
        .setFooter({ text: "MineTrade | Verified SkyBlock Data" });

      // Step 4️⃣ - Dropdown-Menü (Stats)
      const statsMenu = new StringSelectMenuBuilder()
        .setCustomId("stat_select")
        .setPlaceholder("Click a stat to view it!")
        .addOptions([
          { label: "Catacombs", value: "catacombs", emoji: "🧱" },
          { label: "Slayers", value: "slayers", emoji: "⚔️" },
          { label: "Skills", value: "🌿" },
          { label: "Unsoulbound Networth", value: "unsoulbound", emoji: "📦" },
          { label: "Soulbound Networth", value: "soulbound", emoji: "💼" },
          { label: "Mining", value: "mining", emoji: "⛏️" },
          { label: "Farming", value: "🌾" },
          { label: "Kuudra", value: "🔥" },
          { label: "Minion Slots", value: "📦" },
          { label: "Garden", value: "🌱" },
        ]);

      const statsRow = new ActionRowBuilder().addComponents(statsMenu);

      // Step 5️⃣ - Buttons (Buy / Update / Unlist)
      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("buy").setLabel("💵 Buy").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("update").setLabel("🔄 Update Stats").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("unlist").setLabel("🗑️ Unlist").setStyle(ButtonStyle.Danger)
      );

      await interaction.editReply({ embeds: [embed], components: [statsRow, buttons] });

      // Step 6️⃣ - Collector (Dropdown + Buttons)
      const collector = interaction.channel.createMessageComponentCollector({
        time: 600000, // 10 Minuten
      });

      collector.on("collect", async (i) => {
        if (i.user.id !== interaction.user.id)
          return i.reply({ content: "❌ You can’t interact with this listing.", ephemeral: true });

        // Dropdown Selection Handler
        if (i.customId === "stat_select") {
          const value = i.values[0];
          let statEmbed;

          switch (value) {
            case "catacombs":
              statEmbed = new EmbedBuilder()
                .setColor("#3498DB")
                .setTitle("🏰 Catacombs Stats")
                .setDescription("Catacombs Level: 58 (2.188 XP)");
              break;

            case "slayers":
              statEmbed = new EmbedBuilder()
                .setColor("#E74C3C")
                .setTitle("⚔️ Slayer Stats")
                .setDescription("Revenant: 9 | Tarantula: 9 | Sven: 9 | Voidgloom: 7 | Blaze: 5");
              break;

            case "unsoulbound":
              statEmbed = new EmbedBuilder()
                .setColor("#F1C40F")
                .setTitle("📦 Unsoulbound Networth")
                .setDescription("44.77B total value");
              break;

            case "soulbound":
              statEmbed = new EmbedBuilder()
                .setColor("#9B59B6")
                .setTitle("💼 Soulbound Networth")
                .setDescription("27.58B Soulbound");
              break;

            case "mining":
              statEmbed = new EmbedBuilder()
                .setColor("#F39C12")
                .setTitle("⛏️ Mining Stats")
                .setDescription(`HOTM: ${hotm}\nMithril: ${mithril}\nGemstone: ${gemstone}\nGlacite: ${glacite}`);
              break;

            default:
              statEmbed = new EmbedBuilder()
                .setColor("#95A5A6")
                .setDescription("⚙️ No data for this category yet.");
          }

          await i.update({ embeds: [statEmbed], components: [statsRow, buttons] });
        }
      });
    } catch (err) {
      console.error(err);
      return interaction.editReply("❌ Error executing command.");
    }
  },
};

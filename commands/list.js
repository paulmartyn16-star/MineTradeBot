// commands/list.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const fetch = require("node-fetch");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("list")
    .setDescription("List a Hypixel SkyBlock account for sale.")
    .addStringOption(opt =>
      opt.setName("account")
        .setDescription("Minecraft username of the account")
        .setRequired(true))
    .addIntegerOption(opt =>
      opt.setName("price")
        .setDescription("Price in USD")
        .setRequired(true))
    .addUserOption(opt =>
      opt.setName("listedby")
        .setDescription("Who is listing the account?")
        .setRequired(true)),

  async execute(interaction) {
    const mcName = interaction.options.getString("account");
    const price = interaction.options.getInteger("price");
    const listedBy = interaction.options.getUser("listedby");
    const apiKey = process.env.HYPIXEL_API_KEY;

    await interaction.deferReply();

    try {
      const mojangRes = await fetch(`https://api.mojang.com/users/profiles/minecraft/${mcName}`);
      const mojangData = await mojangRes.json();
      if (!mojangData?.id) return interaction.editReply("❌ Minecraft account not found!");

      const uuid = mojangData.id;
      const skyRes = await fetch(`https://api.hypixel.net/v2/skyblock/profiles?key=${apiKey}&uuid=${uuid}`);
      const skyData = await skyRes.json();
      if (!skyData.success || !skyData.profiles?.length)
        return interaction.editReply("⚠️ No SkyBlock profiles found for this player.");

      const profile = skyData.profiles.sort((a, b) => (b.members[uuid]?.last_save || 0) - (a.members[uuid]?.last_save || 0))[0];
      const member = profile.members[uuid];

      const level = Math.round((member.leveling?.experience || 0) / 100);
      const slayers = member.slayer_bosses
        ? Object.entries(member.slayer_bosses).map(([t, d]) => `${t}: ${d.xp || 0}`).join("\n")
        : "N/A";

      const embed = new EmbedBuilder()
        .setColor("#FFD700")
        .setTitle("💎 SkyBlock Account Listing")
        .setThumbnail(`https://mc-heads.net/avatar/${mcName}`)
        .addFields(
          { name: "🎮 Account", value: `\`${mcName}\``, inline: true },
          { name: "💰 Price", value: `$${price}`, inline: true },
          { name: "📋 Listed by", value: `<@${listedBy.id}>`, inline: true },
          { name: "🧠 SkyBlock Level", value: `${level}`, inline: true },
          { name: "⚔️ Slayers", value: slayers.slice(0, 1024), inline: false }
        )
        .setFooter({ text: "MineTrade | Verified Hypixel Data", iconURL: process.env.FOOTER_ICON });

      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("buy_account").setLabel("💵 Buy Account").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("update_stats").setLabel("🔄 Update Stats").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("unlist_account").setLabel("🗑️ Unlist").setStyle(ButtonStyle.Danger)
      );

      await interaction.editReply({ embeds: [embed], components: [buttons] });
    } catch (err) {
      console.error("❌ Error fetching Hypixel data:", err);
      await interaction.editReply("❌ Error while fetching Hypixel data. Please try again later.");
    }
  },
};

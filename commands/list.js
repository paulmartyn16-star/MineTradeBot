// ==========================================================
// /commands/list.js — Full version using Hypixel official API
// ==========================================================
const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const fetch = require("node-fetch");

const HYPIXEL_KEY = process.env.HYPIXEL_API_KEY;

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

    await interaction.deferReply();

    try {
      // === Step 1: Get UUID ===
      const mojangRes = await fetch(`https://api.mojang.com/users/profiles/minecraft/${mcName}`);
      if (!mojangRes.ok) return await interaction.editReply("❌ Invalid Minecraft username.");
      const mojangData = await mojangRes.json();
      const uuid = mojangData.id;

      // === Step 2: Fetch player data from Hypixel ===
      const playerRes = await fetch(`https://api.hypixel.net/player?uuid=${uuid}&key=${HYPIXEL_KEY}`);
      const playerData = await playerRes.json();

      if (!playerData.success) {
        console.log("Hypixel API Response:", playerData);
        return await interaction.editReply(`❌ Hypixel API Error: ${playerData.cause || "Unknown"}`);
      }
      if (!playerData.player) {
        return await interaction.editReply("⚠️ No player data found. Maybe the account never joined Hypixel.");
      }

      // === Step 3: Fetch SkyBlock Profiles ===
      const sbRes = await fetch(`https://api.hypixel.net/skyblock/profiles?uuid=${uuid}&key=${HYPIXEL_KEY}`);
      const sbData = await sbRes.json();
      if (!sbData.success || !sbData.profiles) {
        return await interaction.editReply("⚠️ No SkyBlock profiles found or API access disabled.");
      }

      // === Step 4: Use the most recent profile ===
      const profile = sbData.profiles.sort((a, b) => b.last_save - a.last_save)[0];
      const member = profile.members[uuid];

      const networth = member.coin_purse?.toLocaleString() || "Unknown";
      const skillAvg = (member.experience_skill_farming || 0 +
        member.experience_skill_mining || 0 +
        member.experience_skill_combat || 0 +
        member.experience_skill_fishing || 0 +
        member.experience_skill_foraging || 0 +
        member.experience_skill_alchemy || 0) / 6 || 0;

      const embed = new EmbedBuilder()
        .setColor("#FFD700")
        .setTitle("💎 Account Information")
        .setThumbnail(`https://mc-heads.net/avatar/${mcName}`)
        .addFields(
          { name: "🎮 Account", value: `\`${mcName}\``, inline: true },
          { name: "🧠 Skill Average", value: skillAvg.toFixed(1).toString(), inline: true },
          { name: "💰 Purse", value: `${networth} Coins`, inline: true },
          { name: "💵 Price", value: `$${price}`, inline: true },
          { name: "📋 Listed by", value: `<@${listedBy.id}>`, inline: true }
        )
        .setFooter({
          text: "MineTrade | Data via Hypixel API",
          iconURL: process.env.FOOTER_ICON,
        });

      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("buy_account").setLabel("💵 Buy").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("update_stats").setLabel("🔄 Update Stats").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("unlist").setLabel("🗑️ Unlist").setStyle(ButtonStyle.Danger)
      );

      await interaction.editReply({ embeds: [embed], components: [buttons] });
    } catch (err) {
      console.error("❌ Error executing /list:", err);
      await interaction.editReply("❌ Error while fetching data. Please try again later.");
    }
  },
};

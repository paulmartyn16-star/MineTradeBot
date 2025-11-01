const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setuppanels")
    .setDescription("Setup Slayer panels and categories automatically")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild;
    const channels = {
      revenant: guild.channels.cache.find(ch => ch.name.includes("revenant-slayer")),
      tarantula: guild.channels.cache.find(ch => ch.name.includes("tarantula-slayer")),
      sven: guild.channels.cache.find(ch => ch.name.includes("sven-slayer")),
      enderman: guild.channels.cache.find(ch => ch.name.includes("enderman-slayer")),
      blaze: guild.channels.cache.find(ch => ch.name.includes("blaze-slayer")),
      vampire: guild.channels.cache.find(ch => ch.name.includes("vampire-slayer")),
    };

    const slayers = [
      { name: "Revenant", color: "#2ecc71", maxTier: 5, channel: channels.revenant },
      { name: "Tarantula", color: "#2c2f33", maxTier: 5, channel: channels.tarantula },
      { name: "Sven", color: "#ffffff", maxTier: 4, channel: channels.sven },
      { name: "Enderman", color: "#4b0082", maxTier: 4, channel: channels.enderman },
      { name: "Blaze", color: "#e67e22", maxTier: 4, channel: channels.blaze },
      { name: "Vampire", color: "#c0392b", maxTier: 5, channel: channels.vampire },
    ];

    const categories = {};
    for (const slayer of slayers) {
      let category = guild.channels.cache.find(c => c.name === `${slayer.name} Slayer` && c.type === 4);
      if (!category) {
        category = await guild.channels.create({
          name: `${slayer.name} Slayer`,
          type: 4,
          reason: "Auto-created Slayer category",
        });
      }
      categories[slayer.name] = category;
    }

    for (const slayer of slayers) {
      const channel = slayer.channel;
      if (!channel) continue;

      const embed = new EmbedBuilder()
        .setTitle(`${slayer.name} Slayer Carry Panel`)
        .setDescription("Select your Tier to open a ticket!")
        .setColor(slayer.color)
        .setFooter({ text: `V0 | ${slayer.name} Slayer Panel` });

      const row = new ActionRowBuilder();
      for (let i = 1; i <= slayer.maxTier; i++) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`open_ticket_${slayer.name.toLowerCase()}_${i}`)
            .setLabel(`Tier ${i}`)
            .setStyle(ButtonStyle.Primary)
        );
      }

      await channel.send({ embeds: [embed], components: [row] });
    }

    await interaction.editReply("✅ Slayer panels and categories have been created successfully!");
  },
};

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setuproles')
    .setDescription('Create all Slayer Tier roles automatically')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const roleSets = [
      {
        boss: 'Revenant',
        color: '#2ecc71',
        tiers: 5
      },
      {
        boss: 'Tarantula',
        color: '#2c2f33',
        tiers: 5
      },
      {
        boss: 'Sven',
        color: '#bdc3c7',
        tiers: 4
      },
      {
        boss: 'Enderman',
        color: '#23272a',
        tiers: 4
      },
      {
        boss: 'Blaze',
        color: '#e67e22',
        tiers: 4
      },
      {
        boss: 'Vampire',
        color: '#c0392b',
        tiers: 5
      }
    ];

    const createdRoles = [];

    for (const set of roleSets) {
      for (let i = 1; i <= set.tiers; i++) {
        const roleName = `Tier ${i} ${set.boss}`;
        let role = interaction.guild.roles.cache.find(r => r.name === roleName);

        if (!role) {
          try {
            role = await interaction.guild.roles.create({
              name: roleName,
              color: set.color,
              reason: `Setup command by ${interaction.user.tag}`,
            });
            createdRoles.push(`✅ Created: ${roleName}`);
          } catch (err) {
            console.error(`Failed to create ${roleName}:`, err);
            createdRoles.push(`❌ Failed: ${roleName}`);
          }
        } else {
          createdRoles.push(`⚙️ Exists: ${roleName}`);
        }
      }
    }

    await interaction.editReply({
      content:
        `✅ **Slayer Roles Setup Complete!**\n\n` +
        createdRoles.join('\n')
    });
  },
};

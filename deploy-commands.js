require("dotenv").config();
const { REST, Routes, SlashCommandBuilder } = require("discord.js");

// === ENVIRONMENT VARIABLES ===
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

// === SLASH COMMAND SETUP ===
// Aktuell nur /supportpanel, da Reaction Roles über Dashboard laufen.
const commands = [
  new SlashCommandBuilder()
    .setName("supportpanel")
    .setDescription("Send the MineTrade Support Panel.")
].map(cmd => cmd.toJSON());

// === REGISTER COMMANDS ===
const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  try {
    console.log("🔄 Registering slash commands...");
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    console.log("✅ Slash command '/supportpanel' successfully registered!");
  } catch (error) {
    console.error("❌ Error registering commands:", error);
  }
})();

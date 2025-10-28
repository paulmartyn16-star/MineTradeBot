require("dotenv").config();
const express = require("express");
const session = require("express-session");
const passport = require("passport");
const Strategy = require("passport-discord").Strategy;
const bodyParser = require("body-parser");
const path = require("path");
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  Partials,
} = require("discord.js");

// === DISCORD BOT SETUP ===
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

// === ENV VARIABLES ===
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const FOOTER_ICON = process.env.FOOTER_ICON;
const CATEGORY_ID = process.env.CATEGORY_ID;
const WELCOME_CHANNEL_ID = process.env.WELCOME_CHANNEL_ID;
const RESTOCK_ROLE_ID = process.env.RESTOCK_ROLE_ID;

// === DASHBOARD CONFIG ===
const DASHBOARD_PORT = 3000;
const SERVER_NAME = "MineTrade";
const OWNER_ROLE_NAME = "👑 Owner"; // 🔑 Rollenname für Zugriff

// === EXPRESS DASHBOARD SETUP ===
const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static("public"));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(
  session({
    secret: "minetrade_secret_key",
    resave: false,
    saveUninitialized: false,
  })
);

// === DISCORD OAUTH2 LOGIN ===
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(
  new Strategy(
    {
      clientID: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
callbackURL: "https://minetradebot.onrender.com/callback",
      scope: ["identify", "guilds", "guilds.members.read"],
    },
    (accessToken, refreshToken, profile, done) => done(null, profile)
  )
);

app.use(passport.initialize());
app.use(passport.session());

// === ROLLENBASIERTE AUTHENTIFIZIERUNG ===
const isAuthenticated = async (req, res, next) => {
  if (!req.isAuthenticated()) return res.redirect("/login");

  try {
    const guild = client.guilds.cache.find((g) => g.name === SERVER_NAME);
    if (!guild) return res.send("❌ Server not found.");

    const member = await guild.members.fetch(req.user.id).catch(() => null);
    if (!member) return res.send("❌ You are not a member of the server.");

    const hasRole = member.roles.cache.some(
      (r) => r.name.toLowerCase() === OWNER_ROLE_NAME.toLowerCase()
    );

    if (!hasRole) return res.send("🚫 Access denied – Owner role required.");
    return next();
  } catch (err) {
    console.error("❌ Auth error:", err);
    return res.send("⚠️ Error checking permissions.");
  }
};

// === ROUTES ===
app.get("/", (req, res) => {
  if (!req.isAuthenticated()) return res.redirect("/login");
  res.redirect("/dashboard");
});

app.get("/login", passport.authenticate("discord"));
app.get(
  "/callback",
  passport.authenticate("discord", { failureRedirect: "/" }),
  (req, res) => res.redirect("/dashboard")
);
app.get("/logout", (req, res) => req.logout(() => res.redirect("/")));

app.get("/dashboard", isAuthenticated, async (req, res) => {
  const guild = client.guilds.cache.find((g) => g.name === SERVER_NAME);
  if (!guild)
    return res.send("❌ Server not found. Is the bot in your server?");
  const channels = guild.channels.cache.filter((ch) => ch.type === 0);
  res.render("dashboard", { user: req.user, channels, message: null });
});

// === SEND EMBED (mit RESTOCK Feature) ===
app.post("/send", isAuthenticated, async (req, res) => {
  const { channelId, title, description, color, footer, restock } = req.body;
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel) return res.send("❌ Channel not found");

    const cleanColor = color ? color.replace("#", "") : "FFD700";
    const embedColor = parseInt(cleanColor, 16);

    const embed = new EmbedBuilder()
      .setTitle(title || "Untitled Embed")
      .setDescription(description || "")
      .setColor(embedColor)
      .setFooter({
        text: footer || "MineTrade | Embed System",
        iconURL: FOOTER_ICON,
      });

    // 🔔 RESTOCK FEATURE
    if (restock === "on" && RESTOCK_ROLE_ID) {
      await channel.send({
        content: `<@&${RESTOCK_ROLE_ID}> 🔔 **Restock Alert!**`,
      });
    }

    await channel.send({ embeds: [embed] });

    const guild = client.guilds.cache.find((g) => g.name === SERVER_NAME);
    const channels = guild.channels.cache.filter((ch) => ch.type === 0);
    res.render("dashboard", {
      user: req.user,
      channels,
      message: "✅ Embed sent successfully!",
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("❌ Error sending embed");
  }
});

// === START DASHBOARD ===
app.listen(DASHBOARD_PORT, () =>
  console.log(`🌐 Dashboard running on http://localhost:${DASHBOARD_PORT}`)
);

// === DISCORD BOT CORE ===
client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// ===================== 🎟️ SUPPORT TICKET SYSTEM =====================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;
  if (interaction.customId !== "create_support_ticket") return;

  const guild = interaction.guild;
  const user = interaction.user;

  const existing = guild.channels.cache.find(
    (c) => c.name === `ticket-${user.username.toLowerCase()}`
  );
  if (existing) {
    await interaction.reply({
      content: `❌ You already have an open ticket: ${existing}`,
      ephemeral: true,
    });
    return;
  }

  const ticketChannel = await guild.channels.create({
    name: `ticket-${user.username}`,
    type: 0,
    parent: CATEGORY_ID,
    topic: `Support ticket for ${user.tag}`,
    permissionOverwrites: [
      { id: guild.id, deny: ["ViewChannel"] },
      { id: user.id, allow: ["ViewChannel", "SendMessages", "AttachFiles"] },
    ],
  });

  const ticketEmbed = new EmbedBuilder()
    .setColor("#FFD700")
    .setTitle("🎟️ MineTrade Support Ticket")
    .setDescription(
      `Hello ${user}, 👋\n\nPlease describe your issue below. A support member will assist you shortly.\n\nClick **🔒 Close Ticket** when you're done.`
    )
    .setFooter({ text: "MineTrade | Support", iconURL: FOOTER_ICON });

  const closeButton = new ButtonBuilder()
    .setCustomId("close_ticket")
    .setLabel("🔒 Close Ticket")
    .setStyle(ButtonStyle.Secondary);

  const closeRow = new ActionRowBuilder().addComponents(closeButton);

  await ticketChannel.send({ embeds: [ticketEmbed], components: [closeRow] });

  await interaction.reply({
    content: `✅ Your support ticket has been created: ${ticketChannel}`,
    ephemeral: true,
  });
});

// === Close Ticket Confirmation ===
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId === "close_ticket") {
    const confirmButton = new ButtonBuilder()
      .setCustomId("confirm_close")
      .setLabel("✅ Confirm Close")
      .setStyle(ButtonStyle.Danger);

    const cancelButton = new ButtonBuilder()
      .setCustomId("cancel_close")
      .setLabel("❌ Cancel")
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

    await interaction.reply({
      content: "Are you sure you want to close this ticket?",
      components: [row],
      ephemeral: true,
    });
  }

  if (interaction.customId === "confirm_close") {
    const channel = interaction.channel;
    await interaction.reply({
      content: "🔒 Ticket closed successfully.",
      ephemeral: true,
    });
    await channel.delete().catch((err) =>
      console.error("Error deleting ticket:", err)
    );
  }

  if (interaction.customId === "cancel_close") {
    await interaction.reply({
      content: "❎ Ticket closure cancelled.",
      ephemeral: true,
    });
  }
});

// ===================== ✅ VERIFY BUTTON HANDLER =====================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;
  if (interaction.customId !== "verify_user") return;

  const guild = interaction.guild;
  const member = await guild.members.fetch(interaction.user.id);
  const verifiedRole = guild.roles.cache.find((r) => r.name === "💎 Verified");

  if (!verifiedRole) {
    await interaction.reply({
      content: "❌ The '💎 Verified' role doesn't exist! Please create it first.",
      ephemeral: true,
    });
    return;
  }

  if (member.roles.cache.has(verifiedRole.id)) {
    await interaction.reply({
      content: "✅ You are already verified!",
      ephemeral: true,
    });
  } else {
    await member.roles.add(verifiedRole);
    await interaction.reply({
      content: "💎 You have been verified successfully! Welcome to MineTrade.",
      ephemeral: true,
    });
  }
});

// ===================== 👋 WELCOME MESSAGE =====================
client.on("guildMemberAdd", async (member) => {
  try {
    const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
    if (!channel) return;

    const verifyChannel = member.guild.channels.cache.find(
      (c) => c.name === "✅・verfify"
    );
    const rulesChannel = member.guild.channels.cache.find((c) =>
      c.name.includes("rules")
    );

    const verifyMention = verifyChannel
      ? `<#${verifyChannel.id}>`
      : "#✅・verfify";
    const rulesMention = rulesChannel ? `<#${rulesChannel.id}>` : "#rules";

    const embed = new EmbedBuilder()
      .setColor("#FFD700")
      .setTitle("👋 Welcome to MineTrade!")
      .setDescription(
        `Hey ${member}, welcome to **MineTrade**!\n\n` +
          "We're glad to have you here. Please make sure to:\n" +
          `✅ Verify yourself in ${verifyMention}\n` +
          `📜 Read the rules in ${rulesMention}\n\n` +
          "We hope you enjoy our service 💎"
      )
      .setFooter({
        text: "MineTrade | Welcome System",
        iconURL: FOOTER_ICON,
      });

    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error("❌ Error sending welcome message:", err);
  }
});

client.login(TOKEN);// test push system


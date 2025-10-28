// ==========================================================
// MineTradeBot - Full Version with Reaction Role Dashboard
// ==========================================================

require("dotenv").config();
const express = require("express");
const session = require("express-session");
const passport = require("passport");
const Strategy = require("passport-discord").Strategy;
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");
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
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.Reaction],
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
const DASHBOARD_PORT = process.env.PORT || 3000;
const SERVER_NAME = "MineTrade";
const OWNER_ROLE_NAME = "👑 Owner";

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

// === REACTION ROLE STORAGE ===
const rrFile = path.join(__dirname, "reactionroles.json");
let rr = fs.existsSync(rrFile)
  ? JSON.parse(fs.readFileSync(rrFile, "utf8"))
  : {};

// === DASHBOARD ===
app.get("/dashboard", isAuthenticated, async (req, res) => {
  const guild = client.guilds.cache.find((g) => g.name === SERVER_NAME);
  if (!guild) return res.send("❌ Server not found. Is the bot in your server?");
  const channels = guild.channels.cache.filter((ch) => ch.type === 0);
  const roles = guild.roles.cache.filter((r) => r.name !== "@everyone");
  res.render("dashboard", {
    user: req.user,
    channels,
    roles,
    rrData: rr,
    message: null,
  });
});

// === SEND EMBED (mit RESTOCK Feature) ===
app.post("/send", isAuthenticated, async (req, res) => {
  const { channelId, title, description, color, footer, restock } = req.body;
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel) return res.send("❌ Channel not found");
    const embed = new EmbedBuilder()
      .setTitle(title || "Untitled Embed")
      .setDescription(description || "")
      .setColor(parseInt((color || "#FFD700").replace("#", ""), 16))
      .setFooter({
        text: footer || "MineTrade | Embed System",
        iconURL: FOOTER_ICON,
      });
    if (restock === "on" && RESTOCK_ROLE_ID)
      await channel.send({ content: `<@&${RESTOCK_ROLE_ID}> 🔔 **Restock Alert!**` });
    await channel.send({ embeds: [embed] });
    const guild = client.guilds.cache.find((g) => g.name === SERVER_NAME);
    const channels = guild.channels.cache.filter((ch) => ch.type === 0);
    const roles = guild.roles.cache.filter((r) => r.name !== "@everyone");
    res.render("dashboard", {
      user: req.user,
      channels,
      roles,
      rrData: rr,
      message: "✅ Embed sent successfully!",
    });
  } catch (e) {
    console.error(e);
    res.status(500).send("Error sending embed");
  }
});

// ======================================================================
// === 🧩 REACTION ROLE SYSTEM  (Create / List / Edit / Delete) =========
// ======================================================================

app.post("/reactionrole", isAuthenticated, async (req, res) => {
  const { channelId, title, description, color, footer } = req.body;
  let pairs = [];
  for (let k in req.body)
    if (k.startsWith("emoji_")) {
      const i = k.split("_")[1];
      if (req.body[`emoji_${i}`] && req.body[`role_${i}`])
        pairs.push({ emoji: req.body[`emoji_${i}`], roleId: req.body[`role_${i}`] });
    }
  if (!pairs.length) return res.send("❌ No emoji-role pairs.");

  try {
    const channel = await client.channels.fetch(channelId);
    const embed = new EmbedBuilder()
      .setTitle(title || "Reaction Roles")
      .setDescription(description || "React below to get roles!")
      .setColor(parseInt((color || "#FFD700").replace("#", ""), 16))
      .setFooter({ text: footer || "MineTrade | Reaction Roles", iconURL: FOOTER_ICON });
    const msg = await channel.send({ embeds: [embed] });
    for (const p of pairs) await msg.react(p.emoji);

    rr[msg.id] = {
      channelId,
      channelName: channel.name,
      pairs,
      embed: { title, description, color, footer },
    };
    fs.writeFileSync(rrFile, JSON.stringify(rr, null, 2));
    const guild = client.guilds.cache.find((g) => g.name === SERVER_NAME);
    const channels = guild.channels.cache.filter((ch) => ch.type === 0);
    const roles = guild.roles.cache.filter((r) => r.name !== "@everyone");
    res.render("dashboard", {
      user: req.user,
      channels,
      roles,
      rrData: rr,
      message: "✅ Reaction Role message created!",
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error creating reaction role");
  }
});

// === UPDATE EXISTING REACTION ROLE ===
app.post("/reactionrole/update", isAuthenticated, async (req, res) => {
  const { messageId, title, description, color, footer } = req.body;
  if (!rr[messageId]) return res.send("❌ Unknown message ID.");
  const data = rr[messageId];
  const channel = await client.channels.fetch(data.channelId);
  const msg = await channel.messages.fetch(messageId);
  const embed = new EmbedBuilder()
    .setTitle(title || "Reaction Roles")
    .setDescription(description || "")
    .setColor(parseInt((color || "#FFD700").replace("#", ""), 16))
    .setFooter({ text: footer || "MineTrade | Reaction Roles", iconURL: FOOTER_ICON });
  await msg.edit({ embeds: [embed] });

  let pairs = [];
  for (let k in req.body)
    if (k.startsWith("emoji_")) {
      const i = k.split("_")[1];
      if (req.body[`emoji_${i}`] && req.body[`role_${i}`])
        pairs.push({ emoji: req.body[`emoji_${i}`], roleId: req.body[`role_${i}`] });
    }
  data.pairs = pairs;
  data.embed = { title, description, color, footer };
  fs.writeFileSync(rrFile, JSON.stringify(rr, null, 2));

  for (const react of msg.reactions.cache.values()) await react.remove().catch(() => {});
  for (const p of pairs) await msg.react(p.emoji);
  res.redirect("/dashboard");
});

// === DELETE REACTION ROLE ===
app.post("/reactionrole/delete", isAuthenticated, async (req, res) => {
  const { messageId } = req.body;
  if (!rr[messageId]) return res.send("❌ Unknown message ID.");
  try {
    const ch = await client.channels.fetch(rr[messageId].channelId);
    const m = await ch.messages.fetch(messageId);
    await m.delete();
    delete rr[messageId];
    fs.writeFileSync(rrFile, JSON.stringify(rr, null, 2));
    res.redirect("/dashboard");
  } catch (e) {
    console.error(e);
    res.send("Error deleting message.");
  }
});

// === HANDLE REACTIONS ===
client.on("messageReactionAdd", async (r, u) => {
  if (u.bot || !rr[r.message.id]) return;
  const pair = rr[r.message.id].pairs.find((p) => p.emoji === r.emoji.name);
  if (!pair) return;
  const member = await r.message.guild.members.fetch(u.id);
  await member.roles.add(pair.roleId).catch(() => {});
});
client.on("messageReactionRemove", async (r, u) => {
  if (u.bot || !rr[r.message.id]) return;
  const pair = rr[r.message.id].pairs.find((p) => p.emoji === r.emoji.name);
  if (!pair) return;
  const member = await r.message.guild.members.fetch(u.id);
  await member.roles.remove(pair.roleId).catch(() => {});
});

// === END OF PART 1 ===
// === PART 2 CONTINUATION ===

// ======================================================================
// === BOT CORE + EXISTING SYSTEMS (Ticket, Verify, Welcome) ============
// ======================================================================

// === Start Express Dashboard ===
app.listen(DASHBOARD_PORT, () =>
  console.log(`🌐 Dashboard running on port ${DASHBOARD_PORT}`)
);

// === Bot Ready ===
client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// === Support Ticket System ===
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

// === Ticket Close Confirmation ===
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

// === Verify System ===
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

// === Welcome Message ===
client.on("guildMemberAdd", async (member) => {
  try {
    const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
    if (!channel) return;

    const verifyChannel = member.guild.channels.cache.find(
      (c) => c.name === "✅・verify"
    );
    const rulesChannel = member.guild.channels.cache.find((c) =>
      c.name.includes("rules")
    );

    const verifyMention = verifyChannel
      ? `<#${verifyChannel.id}>`
      : "#✅・verify";
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

// === Bot Login ===
client.login(TOKEN);


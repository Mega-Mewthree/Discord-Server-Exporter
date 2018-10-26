const colors = require("colors/safe");
const prompt = require("prompt");

process.noDeprecation = true;

colors.setTheme({
  verbose: "cyan",
  prompt: "gray",
  info: "cyan",
  data: "gray",
  warn: "yellow",
  debug: "blue",
  error: "red",
  success: "green"
});

prompt.message = "";

prompt.start();

console.info(`${colors.info("[INFO]")} Loading...`);

const Discord = require("discord.js");
const mongoose = require("mongoose");
const fetch = require("node-fetch");
const readline = require("readline");

const config = require("../config.json");

const messageSchema = new mongoose.Schema({
  id: {
    type: String,
    index: {
      unique: true,
      dropDups: true
    }
  }
}, {strict: false});
const roleSchema = new mongoose.Schema({
  id: {
    type: String,
    index: {
      unique: true,
      dropDups: true
    }
  }
}, {strict: false});
const channelSchema = new mongoose.Schema({
  id: {
    type: String,
    index: {
      unique: true,
      dropDups: true
    }
  }
}, {strict: false});
const guildSchema = new mongoose.Schema({
  id: {
    type: String,
    index: {
      unique: true,
      dropDups: true
    }
  }
}, {strict: false});
const emojiSchema = new mongoose.Schema({
  id: {
    type: String,
    index: {
      unique: true,
      dropDups: true
    }
  }
}, {strict: false});
let Message = mongoose.model("messages", messageSchema);
let Role = mongoose.model("roles", roleSchema);
let Channel = mongoose.model("channels", channelSchema);
let Guild = mongoose.model("guild", guildSchema);
let Emoji = mongoose.model("emojis", emojiSchema);

const bot = new Discord.Client({
  disabledEvents: [
    "TYPING_START"
  ]
});

let db = null;
let selectedGuild = null;

const prompts = {
  selectDatabase() {
    prompt.get({
      properties: {
        databaseName: {
          description: colors.prompt("Name of MongoDB database to use")
        }
      }
    }, (err, result) => {
      if (err) {
        if (err.message === "canceled") process.exit();
        throw err;
      }
      console.info(`${colors.info("[INFO]")} Connecting to database...`);
      if (db) {
        db = db.useDb(result.databaseName);
        Message = db.model("messages", messageSchema);
        Role = db.model("roles", roleSchema);
        Channel = db.model("channels", channelSchema);
        Guild = db.model("guild", guildSchema);
        Emoji = db.model("emojis", emojiSchema);
        console.log(`${colors.success("[SUCCESS]")} Connected to database.`);
        if (!selectedGuild) {
          setImmediate(prompts.selectServer);
        } else {
          setImmediate(prompts.selectLogging);
        }
        return;
      } else {
        mongoose.connect(`mongodb://${config.database.host}:${config.database.port}/${result.databaseName}`, {
          useNewUrlParser: true
        });
        db = mongoose.connection;
      }
      db.once("error", err => {
        console.error(`${colors.error("[ERROR]")} Database connection error.`);
        console.error(`${colors.error("[ERROR]")} Is MongoDB installed on your system? Is it running?`);
        console.error(`${colors.error("[ERROR]")} Is the host and port in your config.json correct?`);
        process.exit();
      });
      db.once("connected", () => {
        console.log(`${colors.success("[SUCCESS]")} Connected to database.`);
        if (!selectedGuild) {
          setImmediate(prompts.selectServer);
        } else {
          setImmediate(prompts.selectLogging);
        }
      });
    });
  },
  selectServer() {
    console.log(`${colors.info("[INFO]")} Checking for stored data...`);
    Guild.findOne({}).then(g => {
      if (g && g.id) {
        const guild = bot.guilds.get(g.id);
        if (!guild) {
          console.error(`${colors.error("[ERROR]")} Server does not exist anymore, or bot is not in the server.`);
          console.error(`${colors.error("[ERROR]")} Use a different database for a different server.`);
          setImmediate(prompts.selectServer);
        }
        console.info(`${colors.info("[INFO]")} Using stored server. Use a different database for a different server.`);
        selectedGuild = guild;
        setImmediate(prompts.selectLogging);
      } else {
        prompt.get({
          properties: {
            guildID: {
              description: colors.prompt("Server ID of server to export")
            }
          }
        }, (err, result) => {
          if (err) {
            if (err.message === "canceled") process.exit();
            throw err;
          }
          const guild = bot.guilds.get(result.guildID);
          if (!guild) {
            console.error(`${colors.error("[ERROR]")} Server does not exist, or bot is not in the server.`);
            setImmediate(prompts.selectServer);
            return;
          }
          guild._isNewForLogger = true;
          selectedGuild = guild;
          setImmediate(prompts.selectLogging);
        });
      }
    }).catch(() => {
      console.error(`${colors.error("[ERROR]")} Database error.`);
      process.exit();
    });
  },
  selectLogging() {
    prompt.get({
      properties: {
        option: {
          description: colors.prompt(`Selected Database: ${colors.white(db.name)}\nSelected Server: ${colors.white(selectedGuild.name)}\nOptions:\n  [1]: Log all messages in server\n  [2]: Log all roles in server\n  [3]: Log all channels in server\n  [5]: Log server settings\n  [8]: Change database\n  [9]: Change server\n  [0]: Exit\nChoose an option`)
        }
      }
    }, async (err, result) => {
      if (err) {
        if (err.message === "canceled") process.exit();
        throw err;
      }
      switch (result.option.trim()) {
        case "1": {
          await checkForNewGuild();
          setImmediate(startLogging);
          break;
        }
        case "2": {
          await checkForNewGuild();
          setImmediate(logRoles);
          break;
        }
        case "3": {
          await checkForNewGuild();
          setImmediate(logChannels);
          break;
        }
        case "5": {
          setImmediate(logServerSettings);
          break;
        }
        case "8": {
          setImmediate(prompts.selectDatabase);
          break;
        }
        case "9": {
          setImmediate(prompts.selectServer);
          break;
        }
        case "0": {
          process.exit();
          break;
        }
        default: {
          console.error(`${colors.error("[ERROR]")} Invalid option.`);
          setImmediate(prompts.selectLogging);
        }
      }
    });
  }
};

async function checkForNewGuild() {
  if (selectedGuild._isNewForLogger) {
    console.log(`${colors.info("[INFO]")} First run for this database, logging server settings...`);
    try {
      await logServerSettings(false);
      selectedGuild._isNewForLogger = false;
    } catch (e) {
      console.error(`${colors.error("[ERROR]")} An error occurred while saving server settings.`);
      process.exit();
    }
    console.log(`${colors.success("[SUCCESS]")} Initial server settings logging complete.`);
  }
}

async function startLogging() {
  console.log(`${colors.info("[INFO]")} Starting to log the server "${selectedGuild.name}"...`);
  const textChannels = selectedGuild.channels.array().filter(c => c.type === "text" && c.permissionsFor(c.guild.member(bot.user)).has("VIEW_CHANNEL"));
  for (let i = 0; i < textChannels.length; i++) {
    await logChannelMessages(textChannels[i]);
  }
  console.log(`${colors.success("[SUCCESS]")} Finished logging the server "${selectedGuild.name}".`);
  setImmediate(prompts.selectLogging);
}

async function logChannelMessages(channel) {
  console.log(`${colors.info("[INFO]")} Attempting to fetch stored data for #${channel.name}...`);
  let nextID = "0";
  try {
    const storedMessages = await Message.find(
      {
        channelID: channel.id
      },
      null,
      {
        sort: {
          timestamp: -1,
          id: -1
        }
      }
    );
    if (storedMessages.length > 0) {
      nextID = storedMessages[0].id;
      console.log(`${colors.success("[SUCCESS]")} Stored data loaded for #${channel.name}.`);
      console.log(`${colors.info("[INFO]")} Logging will start with message ID ${nextID}.`);
    } else {
      console.log(`${colors.info("[INFO]")} No stored data found for #${channel.name}.`);
    }
  } catch (e) {
    console.error(`${colors.error("[ERROR]")} Failed to load stored data for #${channel.name}.`);
  }
  console.log(`${colors.info("[INFO]")} Starting to log the channel #${channel.name}...`);
  process.stdout.write(`${colors.info("[INFO]")} Messages logged: 0`);
  const counter = {
    numberLogged: 0
  };
  do {
    try {
      nextID = await logNextMessages(channel, nextID, counter);
      readline.cursorTo(process.stdout, 24);
      readline.clearScreenDown();
      process.stdout.write(counter.numberLogged.toString());
    } catch (e) {
      console.error(`${colors.error("[ERROR]")} ${e}.`);
    }
  } while (nextID !== null);
  console.log();
  console.log(`${colors.success("[SUCCESS]")} Finished logging the channel #${channel.name}.`);
}

async function logNextMessages(channel, id, counter) {
  try {
    const messages = (await channel.fetchMessages({
      limit: 100,
      after: id
    })).array().map(m => convertMessageToObject(m));
    counter.numberLogged += messages.length;
    await Message.insertMany(messages);
    if (messages.length < 100) return null;
    return messages[0].id;
  } catch (e) {
    return null;
  }
}

async function logRoles() {
  console.log(`${colors.info("[INFO]")} Starting to log roles for server "${selectedGuild.name}"...`);
  const roles = selectedGuild.roles.array();
  const bulk = Role.collection.initializeUnorderedBulkOp();
  for (let i = 0, len = roles.length, role; i < len; i++) {
    role = convertRoleToObject(roles[i]);
    bulk.find({
      id: role.id
    }).upsert().updateOne({
      $set: role
    });
  }
  console.log(`${colors.info("[INFO]")} Writing roles for server "${selectedGuild.name}"...`);
  try {
    await new Promise((resolve, reject) => {
      bulk.execute((err, result) => {
        if (err) return reject(err);
        resolve();
      });
    });
  } catch (e) {
    console.error(`${colors.error("[ERROR]")} ${e}`);
    process.exit();
  }
  console.log(`${colors.success("[SUCCESS]")} Finished logging ${roles.length} roles for server "${selectedGuild.name}".`);
  setImmediate(prompts.selectLogging);
}

async function logChannels() {
  console.log(`${colors.info("[INFO]")} Starting to log channels for server "${selectedGuild.name}"...`);
  const channels = selectedGuild.channels.array();
  const bulk = Channel.collection.initializeUnorderedBulkOp();
  for (let i = 0, len = channels.length, channel; i < len; i++) {
    channel = convertChannelToObject(channels[i]);
    bulk.find({
      id: channel.id
    }).upsert().updateOne({
      $set: channel
    });
  }
  console.log(`${colors.info("[INFO]")} Writing channels for server "${selectedGuild.name}"...`);
  try {
    await new Promise((resolve, reject) => {
      bulk.execute((err, result) => {
        if (err) return reject(err);
        resolve();
      });
    });
  } catch (e) {
    console.error(`${colors.error("[ERROR]")} ${e}`);
    process.exit();
  }
  console.log(`${colors.success("[SUCCESS]")} Finished logging ${channels.length} channels for server "${selectedGuild.name}".`);
  setImmediate(prompts.selectLogging);
}

async function logServerSettings(returnToMenuAfterDone = true) {
  console.log(`${colors.info("[INFO]")} Starting to log settings for server "${selectedGuild.name}"...`);
  try {
    await Guild.findOneAndUpdate(
      {},
      {
        $set: convertGuildToObject(selectedGuild)
      },
      {
        upsert: true
      }
    )
  } catch (e) {
    console.error(`${colors.error("[ERROR]")} ${e}`);
    process.exit();
  }
  console.log(`${colors.success("[SUCCESS]")} Finished logging settings for server "${selectedGuild.name}".`);
  if (returnToMenuAfterDone) setImmediate(prompts.selectLogging);
}

function convertMessageToObject(msg) {
  return {
    id: msg.id,
    channelID: msg.channel.id,
    author: msg.author.id,
    content: msg.content,
    timestamp: msg.createdTimestamp,
    editedTimestamp: msg.editedTimestamp,
    mentionEveryone: msg.mentions.everyone,
    mentions: msg.mentions.users.map(u => u.id),
    mentionRoles: msg.mentions.roles.map(r => r.id),
    attachments: msg.attachments.map(a => ({
      filename: a.filename,
      filesize: a.filesize,
      height: a.height,
      width: a.width,
      id: a.id,
      proxyURL: a.proxyURL,
      url: a.url
    })),
    embeds: msg.embeds.map(e => {
      const embed = {
        title: e.title,
        type: e.type,
        description: e.description,
        url: e.url,
        timestamp: e.timestamp,
        color: e.color,
        fields: e.fields.map(f => ({
          inline: f.inline,
          name: f.name,
          value: f.value
        }))
      };
      if (e.footer) {
        embed.footer = {
          iconURL: e.footer.iconURL,
          proxyIconURL: e.footer.proxyIconUrl,
          text: e.text
        };
      }
      if (e.image) {
        embed.image = {
          height: e.image.height,
          width: e.image.width,
          url: e.image.url,
          proxyURL: e.image.proxyURL
        };
      }
      if (e.provider) {
        embed.provider = {
          name: e.provider.name,
          url: e.provider.url
        };
      }
      if (e.thumbnail) {
        embed.thumbnail = {
          height: e.thumbnail.height,
          width: e.thumbnail.width,
          url: e.thumbnail.url,
          proxyURL: e.thumbnail.proxyURL
        };
      }
      if (e.video) {
        embed.video = {
          height: e.video.height,
          width: e.video.width,
          url: e.video.url
        };
      }
      return embed;
    }),
    reactions: msg.reactions.map(r => ({
      count: r.count,
      emoji: {
        id: r.emoji.id,
        name: r.emoji.name,
        animated: r.emoji.animated
      }
    })),
    pinned: msg.pinned,
    webhookID: msg.webhookID,
    type: msg.type
  };
}

function convertRoleToObject(role) {
  return {
    id: role.id,
    name: role.name,
    color: role.color,
    hoist: role.hoist,
    position: role.position,
    permissions: role.permissions,
    managed: role.managed,
    mentionable: role.mentionable
  };
}

function convertChannelToObject(channel) {
  return {
    id: channel.id,
    name: channel.name,
    topic: channel.topic,
    type: channel.type,
    position: channel.position,
    nsfw: channel.nsfw,
    bitrate: channel.bitrate,
    userLimit: channel.userLimit,
    parentID: channel.parent ? channel.parent.id : undefined,
    permissionOverwrites: channel.permissionOverwrites.map(p => ({
      id: p.id,
      type: p.type,
      allow: p.allowed.bitfield,
      deny: p.denied.bitfield
    }))
  };
}

function convertGuildToObject(guild) {
  return {
    id: guild.id,
    name: guild.name,
    nameAcronym: guild.nameAcronym,
    icon: guild.icon,
    splash: guild.splash,
    ownerID: guild.ownerID,
    region: guild.region,
    afkChannelID: guild.afkChannelID,
    afkTimeout: guild.afkTimeout,
    verificationLevel: guild.verificationLevel,
    defaultMessageNotifications: guild.defaultMessageNotifications,
    explicitContentFilter: guild.explicitContentFilter,
    mfaLevel: guild.mfaLevel,
    systemChannelID: guild.systemChannelID
  };
}

console.log(`${colors.info("[INFO]")} Starting Discord bot...`);
bot.login(config.token).catch(() => {
  console.error(`${colors.error("[ERROR]")} Bot failed to connect.`);
  console.error(`${colors.error("[ERROR]")} Does your config.json have the correct Discord bot token?`);
  console.error(`${colors.error("[ERROR]")} Is Discord's API having issues?`);
});

bot.on("ready", () => {
  console.log(`${colors.success("[SUCCESS]")} Discord bot started.`);
  prompts.selectDatabase();
});

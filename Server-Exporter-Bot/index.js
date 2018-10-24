const colors = require("colors/safe");
const Discord = require("discord.js");
const mongoose = require("mongoose");
const prompt = require("prompt");
const readline = require("readline");

const config = require("../config.json");

colors.setTheme({
  verbose: "cyan",
  prompt: "gray",
  info: "blue",
  data: "gray",
  help: "cyan",
  warn: "yellow",
  debug: "blue",
  error: "red",
  success: "green"
});

const messageSchema = new mongoose.Schema({
  id: {
    type: String,
    index: {
      unique: true,
      dropDups: true
    }
  }
}, {strict: false});
const Message = mongoose.model("messages", messageSchema);

const bot = new Discord.Client({
  disabledEvents: [
    "TYPING_START"
  ]
});

prompt.message = "";

prompt.start();

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
  console.info(`${colors.info("[INFO]")}: Connecting to database...`);
  mongoose.connect(`mongodb://localhost/${result.databaseName}`, {
    useNewUrlParser: true
  });
  const db = mongoose.connection;
  db.on("error", err => {
    console.error(`${colors.error("[ERROR]")}: Database connection error.`);
    process.exit();
  });
  db.on("open", () => {
    console.log(`${colors.success("[SUCCESS]")}: Connected to database.`);
    console.log(`${colors.info("[INFO]")}: Starting Discord bot...`);
    bot.login(config.token);
  });
});

const prompts = {
  selectServer() {
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
        console.error(`${colors.error("[ERROR]")}: Server does not exist, or bot is not in the server.`);
        setImmediate(prompts.selectServer);
        return;
      }
      setImmediate(prompts.selectLogging, guild);
    });
  },
  selectLogging(guild) {
    prompt.get({
      properties: {
        option: {
          description: colors.prompt("Logging options:\n  [1]: All messages\nChoose logging option")
        }
      }
    }, (err, result) => {
      if (err) {
        if (err.message === "canceled") process.exit();
        throw err;
      }
      switch (result.option) {
        case "1": {
          setImmediate(startLogging, guild);
          break;
        }
        default: {
          console.error(`${colors.error("[ERROR]")}: Invalid option.`);
          setImmediate(prompts.selectLogging, guild);
        }
      }
    });
  }
};

async function startLogging(guild) {
  console.log(`${colors.info("[INFO]")}: Starting to log the server "${guild.name}"...`);
  const textChannels = guild.channels.array().filter(c => c.type === "text" && c.permissionsFor(c.guild.member(bot.user)).has("VIEW_CHANNEL"));
  for (let i = 0; i < textChannels.length; i++) {
    await logChannel(textChannels[i]);
  }
}

async function logChannel(channel) {
  console.log(`${colors.info("[INFO]")}: Starting to log the channel #${channel.name}...`);
  // console.log(`${colors.info("[INFO]")}: Messages logged: 0`);
  const counter = {
    numberLogged: 0
  };
  let nextID = "0";
  do {
    try {
      nextID = await logNextMessages(channel, nextID, counter);
      // readline.cursorTo(process.stdout, 26);
      // process.stdout.write(counter.numberLogged);
    } catch (e) {
      console.error(`${colors.error("[ERROR]")}: ${e}.`);
    }
  } while (nextID !== null);
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
      users: r.users.map(u => u.id),
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

bot.on("ready", () => {
  console.log(`${colors.success("[SUCCESS]")}: Discord bot started.`);
  prompts.selectServer();
});

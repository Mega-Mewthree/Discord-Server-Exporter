# Discord Server Exporter
Exports message history and more from Discord servers.

## Installation

Download this and extract it.

Install [Node.JS](https://nodejs.org/en/) and [MongoDB](https://www.mongodb.com/download-center/community).

Run `npm install` in the extracted folder.

Create a Discord bot and add it to your server.

Rename the `config.example.json` file to `config.json` and put your Discord bot token into it where indicated.

## Use

Run `npm run logger` to start the logger, and follow the prompts.

Data for your server will be stored in your selected MongoDB database, and files will be stored in the `Exported_Resources` folder.

An app to view the data in a Discord-like format will be available later.

A way to restore a backup will also be available later.

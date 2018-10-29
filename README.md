# Discord Server Exporter

[![GitHub package version](https://img.shields.io/github/package-json/v/Mega-Mewthree/Discord-Server-Exporter.svg?label=github&style=popout)](https://github.com/Mega-Mewthree/Discord-Server-Exporter)

Exports message history and more from Discord servers.

## Installation

Obtain the repo by doing one of the following:

* [`git clone`](https://help.github.com/articles/cloning-a-repository/)
* [Download and extract](https://stackoverflow.com/a/6466993)

Install [Node.js](https://nodejs.org/en/) and [MongoDB](https://www.mongodb.com/download-center/community).

Node.js includes `npm`, which will allow you to install this project's dependencies. Navigate to the project folder in a command prompt and run:

    npm install

Create a Discord bot and add it to your server.

In a text editor, rename `config.example.json` to `config.json` and change the `token` property to your token, which will replace `YOUR_SUPER_SECRET_BOT_TOKEN` (keep the quotes).

## Usage

Run `npm run logger` to start the logger, and follow the prompts.

Data for your server will be stored in your selected MongoDB database, and files will be stored in the `Exported_Resources` folder.

An app to view the data in a Discord-like format will be available later.

A way to restore a backup will also be available later.

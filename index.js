"use strict";

const irc = require("irc");
const vm = require("vm");
const util = require("util");
const fs = require("fs");
const path = require("path");
const yargs = require("yargs");

const argv = yargs
    .default("conf", "./config.json")
    .argv;

const configFile = fs.readFileSync(path.resolve(argv.conf), "utf-8");
const config = JSON.parse(configFile);



const client = new irc.Client(config.server, config.nick, config.config);

Symbol.environment = Symbol("environment");
let sandbox = Object.create(Object.prototype, {
    say: {
        value: function say(message) {
            client.say(sandbox[Symbol.environment].returnTo, message);
        }
    },
    JSON: {
        value: JSON
    },
    inspect: {
        value: util.inspect.bind(util)
    }
});

vm.createContext(sandbox);

client.on("join#mojo", (nick, message) => {
    client.say("#mojo", "Hello people!");
});

client.on("message", (nick, to, message, raw) => {
    const prefix = String(config.prefix);
    if(!message.startsWith(prefix)) return;
    message = message.substr(prefix.length);
    const returnTo = to == client.nick ? nick : to;
    sandbox[Symbol.environment] = {
        returnTo,
        from: nick,
        to,
        script: message,
        raw
    };
    try {
        let result = vm.runInContext(message, sandbox, {
            timeout: 200
        });
        client.say(returnTo, result);
    } catch(e) {
        client.say(returnTo, e);
    }
});

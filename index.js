const Discord = require('discord.js');
const client = new Discord.Client();
const ytdl = require('ytdl-core');
const fs = require('fs');
const getYouTubeID = require('get-youtube-id');
const fetchVideoInfo = require('youtube-info');
const spotify = require('./spotify.js');
const youtube = require('./youtube.js');

console.log("Setting up settings...");
var config = JSON.parse(fs.readFileSync('./settings.json', 'utf8'));

const spot_client_id = config.spot_client_id;
const spot_client_secret = config.spot_client_secret;
const yt_api_key = config.yt_api_key;
const bot_controller = config.bot_controller;
const prefix = config.prefix;

var backQueue = [];
var queue = [];
var queueNames = [];
var isPlaying = false;
var dispatcher = null;
var voiceChannel = null;
var skipReq = 0;
var skippers = [];
var currentBackQueue = 0;

//NOTE: MusicBot Playlist -- 0325zM4CZn1I9iM2a8ApM2
//current one is inspiring songs

//TODO: Add authentication passing so no hardcoded stuff
console.log("Setting YouTube API key...");
youtube.setApiKey(yt_api_key);

console.log("Authenticating Spotify...");
spotify.authenticate(spot_client_id, spot_client_secret, function(token) {
    console.log("Grabbing Spotify playlist information...");
    spotify.getPlayList('fordmsmith', '1XrnmgFy2tavyIhzD03Yyo', token, function(playlist) {
        playlist.items.forEach(function(e) {
            backQueue.push(e.track.name + " - " + e.track.artists[0].name);
        });
        console.log("Shuffling backQueue...");
        shuffle(backQueue);
        console.log("Logging in...");
        client.login(config.discord_token);
    });
});

client.on('message', function(message) {
    const member = message.member;
    const mess = message.content.toLowerCase();
    const args = message.content.split(' ').slice(1).join(" ");

    if (mess.indexOf("discord.gg") > -1) {
        message.reply("You are not allowed to post other discords here!");
        message.delete();
        return;
    } else if (mess.startsWith(prefix + 'skip')) {
        if (skippers.indexOf(message.author.id) == -1) {
            skippers.push(message.author.id);
            skipReq++;
            if (skipReq >= Math.ceil((voiceChannel.members.size - 1) / 2)) {
                skip_song();
                message.reply("your skip has been acknowledged. Skipping now!");
            } else {
                message.reply("your skip has been acknowledged. You need **" + ((Math.ceil((voiceChannel.members.size - 1) / 2)) - skipReq) + "** more skips requests.");
            }
        } else {
            message.reply("you already voted!");
        }
    } else if (mess.startsWith(prefix + 'fskip') && member.roles.has(bot_controller)) {
        try {
            skip_song();
        } catch (err) {
            console.log(err);
        }
    }
    // console.log(message.member.roles.has("319575587922378752"));
    else if (mess.startsWith(prefix + 'play') && message.channel.id === "319301550902214657") {
        if (member.voiceChannel || voiceChannel != null) {
            if (queue.length > 0 || isPlaying) {
                if (args.toLowerCase().indexOf("list=") === -1) {
                    youtube.getID(args, function(id) {
                        add_to_queue(id);
                        fetchVideoInfo(id, function(err, videoInfo) {
                            if (err) throw new Error(err);
                            message.reply(" added to queue: **" + videoInfo.title + "**")
                            queueNames.push(videoInfo.title);
                        });
                    });
                } else {
                    youtube.getPlayListSongs(args.match(/list=(.*)/)[args.match(/list=(.*)/).length - 1], 50, function(arr) {
                        arr.forEach(function(e) {
                            add_to_queue(e.snippet.resourceId.videoId);
                            queueName.push(e.snippet.title);
                        });
                        youtube.getPlayListMetaData(args.match(/list=(.*)/)[args.match(/list=(.*)/).length - 1], 50, function(data) {
                            message.reply(" added to queue, playlist: **" + data.snippet.title + "**");
                        });
                    });
                }
            } else {
                isPlaying = true;
                if (args.toLowerCase().indexOf("list=") === -1) {
                    // console.log(args.toLowerCase().indexOf("list=") === -1);
                    youtube.getID(args, function(id) {
                        queue.push(id);
                        playMusic(id, message, false);
                        fetchVideoInfo(id, function(err, videoInfo) {
                            if (err) throw new Error(err);
                            queueNames.push(videoInfo.title);
                            message.reply(" now playing: **" + videoInfo.title + "**")
                        });
                    });
                } else {
                    youtube.getPlayListSongs(args.match(/list=(.*)/)[args.match(/list=(.*)/).length - 1], 50, function(arr) {
                        arr.forEach(function(e) {
                            add_to_queue(e.snippet.resourceId.videoId);
                            queueNames.push(e.snippet.title);
                        });
                        playMusic(queue[0], message, false);
                        youtube.getPlayListMetaData(args.match(/list=(.*)/)[args.match(/list=(.*)/).length - 1], 50, function(data) {
                            message.reply(" now playing playlist: **" + data.snippet.title + "**");
                        });
                    });
                }
            }
        } else {
            message.reply('You need to join a voice channel first!');
        }
    } else if (mess.startsWith(prefix + 'pause') && member.roles.has(bot_controller)) {
        try {
            dispatcher.pause();
            message.reply("Pausing!");
        } catch (error) {
            message.reply("No song playing");
        }
    } else if (mess.startsWith(prefix + 'resume') && member.roles.has(bot_controller)) {
        try {
            dispatcher.resume();
            message.reply("Resuming!");
        } catch (error) {
            message.reply("No song playing");
        }
    } else if (/(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig.exec(mess) != null && message.channel.id !== "268570651705606144") {
        client.channels.get('268570651705606144').send(message.author + " said in an **incorrect** chat: \n\n\n" + message.content);
        message.delete();
    } else if (mess.startsWith(prefix + "join")) {
        if (member.voiceChannel) {
            youtube.search_video(backQueue[currentBackQueue] + " official", function(id) {
                playMusic(id, message, true);
                isPlaying = true;
                message.reply(" joining voice chat -- " + message.member.voiceChannel.name + " -- and starting radio!");
            });
        } else {
            message.reply(" you need to be in a chat!");
        }
    } else if (mess.startsWith(prefix + "queue")) {
        var ret = "\n\n`";
        for (var i = 0; i < queueNames.length; i++) {
            ret += (i + 1) + ": " + queueNames[i] + (i === 0 ? " **(Current)**" : "") + "\n";
        }
        ret += "`"
        message.reply(ret);
    } else if (mess.startsWith(prefix + "song")) {
        message.reply(" the current song is: *" + (queueNames[0] || backQueue[currentBackQueue]) + "*")
    }
});

client.on('ready', function() {
    console.log('I am ready!');
});

function skip_song() {
    dispatcher.end();
}

function playMusic(id, message, backQueueUsed) {
    voiceChannel = message.member.voiceChannel || voiceChannel;

    if (voiceChannel != null) {
        voiceChannel.join()
            .then(function(connection) {
                stream = ytdl("https://www.youtube.com/watch?v=" + id, {
                    filter: 'audioonly'
                });
                skipReq = 0;
                skippers = [];

                dispatcher = connection.playStream(stream);
                dispatcher.on('end', function() {
                    skipReq = 0;
                    skippers = [];
                    if (backQueueUsed) {
                        currentBackQueue++;
                    } else {
                        queue.shift();
                        queueNames.shift();
                    }
                    if (queue.length === 0) {
                        queue = [];
                        queueNames = [];
                        if (backQueue.length === currentBackQueue) {
                            currentBackQueue = 0;
                        }
                        youtube.search_video(backQueue[currentBackQueue] + " official", function(id) {
                            playMusic(id, message, true);
                        });
                    } else {
                        playMusic(queue[0], message, false);
                    }
                });
            });
    } else {
        message.reply("Please be in a voiceChannel or have the bot already in a voiceChannel");
    }
}

function shuffle(array) {
    var currentIndex = array.length,
        temporaryValue, randomIndex;

    while (1 !== currentIndex) {

        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;

        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }

    return array;
}

function add_to_queue(strID) {
    if (youtube.isYoutube(strID)) {
        queue.push(getYouTubeID(strID));
    } else {
        queue.push(strID);
    }
}

const discordVoice = require('@discordjs/voice');
const { channel } = require('diagnostics_channel');
const discord = require('discord.js');
const fs = require('fs');

colors = {
    'aqua': 0x5abdd1,       // Search and queue
    'red': 0xa11a1a,        // Errors
    'orange': 0xdbbb1a,     // Currently playing
    'green': 0x11ba49       // Bot ready message
}

class Queue
{
    songQueue = [];
    currentSong = null;
    
    guildId = null;
    voiceChannel = null;    // The actual channel
    textChannel = null;     // channel ID

    // The last interaction, the last message will be updated
    lastInteraction = null;

    paused = false;

    /**
     * @param {VoiceConnection} connection
     */
    connection = null;
    subscription = null;
    player = null;

    constructor(guildId, voiceChannel, textChannel) {
        this.guildId = guildId;
        this.voiceChannel = voiceChannel;
        this.textChannel = textChannel;
    }

    setGuildId(guildId) {
        this.guildId = guildId;
    }

    setVoiceChannel(voiceChannel) {
        this.voiceChannel = voiceChannel;
    }

    setTextChannel(textChannel) {
        this.textChannel = textChannel;
    }
    
    setLastInteraction(interaction) {
        this.lastInteraction = interaction;
    }

    maybeJoinVoiceChannel() {
        if (this.connection) return;

        // console.log(this.voiceChannel ?? "No voice channel");
        // console.log(this.textChannel ?? "No text channel");

        // Join the voice channel
        this.connection = discordVoice.joinVoiceChannel({
            channelId: this.voiceChannel.id,
            guildId: this.guildId,
            adapterCreator: this.voiceChannel.guild.voiceAdapterCreator
        });
        
        // Create audio player
        this.player = discordVoice.createAudioPlayer();
        this.subscription = discordVoice.getVoiceConnection(this.guildId).subscribe(this.player);

        
		// Configure audio player
		this.player.on('stateChange', (oldState, newState) => {
            if (newState.status === discordVoice.AudioPlayerStatus.Idle && oldState.status !== discordVoice.AudioPlayerStatus.Idle) {
                // Play next song, if the current song has finished playing
                void this.playNextOrLeave();

            } else if (newState.status === discordVoice.AudioPlayerStatus.Playing) {
                if (this.lastInteraction) {
                    let embed = new discord.MessageEmbed()
                        .setTitle(`Now playing  ${this.getCurrentSong().title} by ${this.getCurrentSong().artist}!`)
                        .setColor(colors.green)
                    ;

                    this.lastInteraction.editReply({
                        embeds: [embed],
                        components: []
                    });
                }
            }
        });

        console.log(`Joined voice channel: ${this.voiceChannel.name}`);
    }

    addSong(song) {
        this.songQueue.push(song);
    }
    
    addOrPlay(song) {
        if (this.currentSong !== null) {
            this.addSong(song);
            return
        }

        this.playSong(song);
    }

    playNextOrLeave() {
        if (this.songQueue.length > 0) {
            this.playSong(this.songQueue[0]);
        } else {
            this.leaveVoiceChannel();
        }
    }

    getCurrentSong() {
        return this.currentSong;
    }

    getSongQueue() {
        return this.songQueue;
    }

    removeSongFromQueue(song) {
        this.songQueue.splice(this.songQueue.indexOf(song), 1);
    }

    async playSong(song) {
        this.currentSong = song;
        this.maybeJoinVoiceChannel();
        
        console.log("Playing song: " + song.title + " by " + song.artist);

        let audioResource = await song.createAudioResource(song.url);

        // Remove the song from the queue
        this.songQueue.shift();

        await this.player.play(audioResource);
    }

    skip() {
        this.player.stop();
        this.playNextOrLeave();
    }

    pause() {
        if (this.paused) {
            this.player.pause();
            this.paused = true;
        } else {
            this.player.unpause();
            this.paused = false;
        }
    }

    leaveVoiceChannel() {
        this.connection.destroy();
        this.connection = null;
        this.player = null;
        this.songQueue = [];
        this.currentSong = null;
    }
}

module.exports = Queue;
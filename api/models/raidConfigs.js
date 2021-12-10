const mongoose = require('mongoose')

const spriteSchema = new mongoose.Schema({
    name: String,
    file: String,
    startFrame: Number,
    endFrame: Number,
    frameWidth: Number,
    frameHeight: Number,
    frameRate: Number,
    cellCount: Number
});

const soundSchema = new mongoose.Schema({
    file: String,
    volume: Number
})

const raidSchema = new mongoose.Schema({
    twitchChannel: String,
    name: String,
    message: String,
    sprites: [spriteSchema],
    music: soundSchema,
    leavingSound: soundSchema
});

module.exports = mongoose.model("raidConfigs", raidSchema);
var mongoose = require('mongoose')

var oneTimeKey = new mongoose.Schema({
    twitchChannelId: String,
    oneTimeKey: String
});

module.exports = mongoose.model("oneTimeKeys", oneTimeKey)
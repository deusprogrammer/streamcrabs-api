var mongoose = require('mongoose')

var oneTimeKey = new mongoose.Schema({
    accountId: String,
    oneTimeKey: String
});

module.exports = mongoose.model("oneTimeKeys", oneTimeKey)
const express = require('express');
const Bots = require('../models/bots');

import DynamicAlerts from '../models/dynamicAlerts';
import OneTimeKeys from '../models/oneTimeKeys';

let router = express.Router();

router.route("/:key")
    .get(async (request, response) => {
        let oneTimeKeyId = request.params.key;

        console.log("KEY: " + oneTimeKeyId);

        let oneTimeKey = await OneTimeKeys.findOne({oneTimeKey: oneTimeKeyId}).exec();

        console.log("ONE TIME KEY: " + JSON.stringify(oneTimeKey, null, 5));
        
        if (!oneTimeKey) {
            response.statusCode = 401;
            return response.send();
        }
        
        await OneTimeKeys.deleteOne({oneTimeKey: oneTimeKeyId}).exec();

        let twitchChannelId = oneTimeKey.twitchChannelId;
        try {
            let bot = await Bots.findOne({twitchChannelId}).exec();
            let dynamicAlerts = await DynamicAlerts.find({twitchChannel}, null, {sort: {name: 1}})
            return response.json({...bot, dynamicAlerts});
        } catch (error) {
            console.error(error);
            response.status(500);
            return response.send(error);
        }
    })

module.exports = router;
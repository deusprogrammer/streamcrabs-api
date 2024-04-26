const express = require('express');
const Bots = require('../models/bots');

const Configs = require('../models/configs');

import OneTimeKeys from '../models/oneTimeKeys';
import {authenticatedUserHasRole, getAuthenticatedTwitchUserId} from '../utils/SecurityHelper';

let router = express.Router();

const randomUuid = () => {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

router.route("/")
    .post(async (request, response) => {
        try {
            let twitchUser = getAuthenticatedTwitchUserId(request);
            let oneTimeKey = await OneTimeKeys.create({accountId: twitchUser, oneTimeKey: randomUuid()});
            return response.json(oneTimeKey);
        } catch (error) {
            console.error(error);
            response.status(500);
            return response.send(error);
        }
    })

module.exports = router;
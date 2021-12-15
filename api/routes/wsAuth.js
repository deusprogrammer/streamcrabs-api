const express = require('express');
const jsonwebtoken = require('jsonwebtoken');

import {getAuthenticatedTwitchUserId, getAuthenticatedTwitchUserName} from '../utils/SecurityHelper';

let router = express.Router();

const key = process.env.TWITCH_SHARED_SECRET;
const defaultSecret = Buffer.from(key, 'base64');

const createExpirationDate = () => {
    var d = new Date();
    var year = d.getFullYear();
    var month = d.getMonth();
    var day = d.getDate();
    var c = new Date(year + 1, month, day);
    return c;
}

const createJwt = (user_id, login, channel_id, secret) => {
    return jsonwebtoken.sign({
        exp: createExpirationDate().getTime(),
        user_id,
        login,
        role: "user",
        channel_id
    }, secret);
}

router.route("/")
    .post((request, response) => {
        let login = getAuthenticatedTwitchUserName(request);
        let userId = getAuthenticatedTwitchUserId(request);

        let jwt = createJwt(userId, login, request.body.channel, defaultSecret);

        return response.json({jwt});
    });

module.exports = router;
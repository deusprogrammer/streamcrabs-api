const express = require('express');
const Bots = require('../models/bots');

const axios = require('axios');
const Configs = require('../models/configs');

const BATTLE_BOT_JWT = process.env.BATTLE_BOT_JWT;
const redirectUrl = "https://deusprogrammer.com/util/twitch/registration/callback";

import {authenticatedUserHasRole, getAuthenticatedTwitchUserId} from '../utils/SecurityHelper';

const clientId = process.env.TWITCH_CLIENT_ID;
const clientSecret = process.env.TWITCH_CLIENT_SECRET;
const TWITCH_EXT_CLIENT_ID = process.env.TWITCH_EXT_CLIENT_ID;
const TWITCH_BOT_CLIENT_ID = process.env.TWITCH_BOT_CLIENT_ID;
const TWITCH_BOT_USER = process.env.TWITCH_BOT_USER;
const TWITCH_BOT_PASS = process.env.TWITCH_BOT_PASS;
const TWITCH_BOT_ACCESS_TOKEN = process.env.TWITCH_BOT_ACCESS_TOKEN;
const TWITCH_BOT_JWT = process.env.TWITCH_BOT_JWT;
const PROFILE_API_URL = process.env.PROFILE_API_URL;
const BATTLE_API_URL = process.env.BATTLE_API_URL;
const refreshUrl = "https://deusprogrammer.com/util/twitch/registration/refresh";

let router = express.Router();

const randomUuid = () => {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

const getProfile = async (accessToken) => {
    try {
        let res = await axios.get(`https://api.twitch.tv/helix/users`, {
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Client-Id": clientId
            }
        });

        return res.data;
    } catch (error) {
        console.error("Call to get profile failed! " + error.message);
        throw error;
    }
}

const createTrinaryUser = async (username, userId) => {
    // Create a user for profile service so the main UI page can be accessed
    try {
        await axios.post(`http://10.0.0.243:8090/users`, {
            username,
            password: randomUuid(),
            connected: {
                twitch: {
                    userId: userId.toString(),
                    name: username,
                    channels: [
                        userId.toString()
                    ]
                }
            },
            roles: ["TWITCH_BROADCASTER", "MEDIA_UPLOADER"]
        }, {
            headers: {
                contentType: "application/json",
                Authorization: `Bearer ${BATTLE_BOT_JWT}`
            }
        });
    } catch (error) {
        if (error.response && error.response.status !== 409) {
            throw error;
        }
    }
}

const getAccessToken = async (code) => {
    try {
        let res = await axios.post(`https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&code=${code}&grant_type=authorization_code&redirect_uri=${redirectUrl}`);
        return res.data;
    } catch (error) {
        console.error("Call to get access token failed! " + error.message);
        throw error;
    }
}

const validateAccessToken = async (accessToken) => {
    let res = await axios.get(`https://id.twitch.tv/oauth2/validate`, {
        headers: {
            "Authorization": `Bearer ${accessToken}`
        }
    });

    return res.data;
}

const refreshAccessToken = async (refreshToken) => {
    var params = new URLSearchParams();
    params.append('grant_type', 'refresh_token');
    params.append('refresh_token',encodeURIComponent(refreshToken));
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);

    let res = await axios.post(`https://id.twitch.tv/oauth2/token`, params, {responseType: "json"});

    return res.data;
}

const getContainer = async (containerName) => {
    let res = await axios.get(`http://10.0.0.243:2375/containers/${containerName}/json`);

    return res.data;
}

const isContainerRunning = async (containerName) => {
    try {
        let container = await getContainer(containerName);
        return container.State.Running;
    } catch (error) {
        if (error.response && error.response.status !== 404) {
            throw error;
        }
        return false; 
    }
}

const changeContainerState = async (containerName, state) => {
    try {
        let res = await axios.post(`http://10.0.0.243:2375/containers/${containerName}/${state}`);

        return res.data;
    } catch (error) {
        if (error.response && error.response.status !== 404) {
            throw error;
        }

        return {};
    }
}

const deleteBotContainer = async (containerName) => {
    try {
        let res = await axios.delete(`http://10.0.0.243:2375/containers/${containerName}?force=true`);

        return res.data;
    } catch (error) {
        if (error.response && error.response.status !== 404) {
            throw error;
        } 

        return {};
    }
}

const createBotContainer = async (userId, containerName) => {
    const url = `http://10.0.0.243:2375/containers/create?name=${containerName}`;
    let res = await axios.post(url, {
        Image: "mmain/cbd-bot:latest",
        Env: [
            `TWITCH_EXT_CHANNEL_ID=${userId}`,
            `TWITCH_EXT_CLIENT_ID=${TWITCH_EXT_CLIENT_ID}`,
            `TWITCH_BOT_ACCESS_TOKEN=${TWITCH_BOT_ACCESS_TOKEN}`,
            `TWITCH_BOT_JWT=${TWITCH_BOT_JWT}`,
            `TWITCH_BOT_USER=${TWITCH_BOT_USER}`,
            `TWITCH_BOT_PASS=${TWITCH_BOT_PASS}`,
            `TWITCH_BOT_CLIENT_ID=${TWITCH_BOT_CLIENT_ID}`,
            `PROFILE_API_URL=${PROFILE_API_URL}`,
            `BATTLE_API_URL=${BATTLE_API_URL}`
        ]
    });

    return res.data;
}

router.route("/")
    .get(async (request, response) => {
        try {
            let bots = await Bots.find({}, null).exec();

            // Clear the shared secret key
            bots.forEach((bot) => {
                bot.sharedSecretKey = null;
            })

            return response.json(bots);
        } catch (error) {
            console.error(error);
            response.status(500);
            return response.send(error);
        }
    })
    .post(async (request, response) => {
        try {
            // Get access token.
            let accessTokenRes = await getAccessToken(request.body.twitchAuthCode);

            // Get user profile.
            let userRes = await getProfile(accessTokenRes.access_token);

            // Get approved bots.
            let profile = userRes.data[0];
            let allowedBots = await Configs.findOne({name: "allowedBots"}).exec();

            if (!allowedBots.values.includes(profile.id.toString())) {
                response.status(403);
                return response.send("You are not allowed to create a bot");
            }

            // Create user.
            await createTrinaryUser(profile.login, profile.id);

            // Create body
            request.body.sharedSecretKey = randomUuid();
            request.body.twitchChannel = profile.login;
            request.body.twitchChannelId = parseInt(profile.id);
            request.body.twitchOwnerUserId = parseInt(profile.id);
            request.body.accessToken = accessTokenRes.access_token;
            request.body.refreshToken = accessTokenRes.refresh_token;
            request.body.config = {
                cbd: true,
                requests: true
            }
            
            // Save body
            let bot = await Bots.create(request.body);
            return response.json(bot);
        } catch (error) {
            console.error(error);
            response.status(500);
            return response.send(error);
        }
    })

router.route("/:id")
    .get(async (request, response) => {
        let twitchUser = getAuthenticatedTwitchUserId(request);
        if (twitchUser !== request.params.id && !authenticatedUserHasRole(request, "TWITCH_ADMIN") && !authenticatedUserHasRole(request, "TWITCH_BOT")) {
            response.status(403);
            return response.send("Insufficient privileges");
        }

        try {
            let bot = await Bots.findOne({twitchChannelId: request.params.id}).exec();

            // Check auth token
            try {
                await validateAccessToken(bot.accessToken);
            } catch (error) {
                console.error("STALE ACCESS TOKEN");
                // Refresh token on failure to validate
                let refresh = await refreshAccessToken(bot.refreshToken);
                bot.accessToken = refresh.access_token;
                bot.refreshToken = refresh.refresh_token;
                await Bots.findByIdAndUpdate(bot._id, bot);
                
                console.log("REFRESHED TOKEN SUCCESSFULLY");
            }
            
            return response.json(bot);
        } catch (error) {
            console.error(error);
            response.status(500);
            return response.send(error);
        }
    })
    .put(async (request, response) => {
        let twitchUser = getAuthenticatedTwitchUserId(request);
        if (twitchUser !== request.params.id && !authenticatedUserHasRole(request, "TWITCH_ADMIN")) {
            response.status(403);
            return response.send("Insufficient privileges");
        }

        try {
            let bot = await Bots.updateOne({twitchChannelId: request.params.id}, request.body);
            return response.json(bot);
        } catch (error) {
            console.error(error);
            response.status(500);
            return response.send(error);
        }
    })
    .delete(async (request, response) => {
        let twitchUser = getAuthenticatedTwitchUserId(request);
        if (twitchUser !== request.params.id && !authenticatedUserHasRole(request, "TWITCH_ADMIN")) {
            response.status(403);
            return response.send("Insufficient privileges");
        }

        try {
            let bot = await Bots.deleteOne({twitchChannelId: request.params.id}).exec();
            return response.json(bot);
        } catch (error) {
            console.error(error);
            response.status(500);
            return response.send(error);
        }
    })

router.route("/:id/config")
    .get(async (request, response) => {
        let twitchUser = getAuthenticatedTwitchUserId(request);
        if (twitchUser !== request.params.id && !authenticatedUserHasRole(request, "TWITCH_BOT")) {
            response.status(403);
            return response.send("Insufficient privileges");
        }

        try {
            let bot = await Bots.findOne({twitchChannelId: request.params.id});
            return response.json(bot.config);
        } catch (error) {
            console.error(error);
            response.status(500);
            return response.send(error);
        }
    })
    .put(async (request, response) => {
        let twitchUser = getAuthenticatedTwitchUserId(request);
        if (twitchUser !== request.params.id && !authenticatedUserHasRole(request, "TWITCH_ADMIN")) {
            response.status(403);
            return response.send("Insufficient privileges");
        }

        try {
            let bot = await Bots.findOne({twitchChannelId: request.params.id});
            bot.config = request.body;
            await Bots.updateOne({twitchChannelId: request.params.id}, bot);
            return response.json(bot);
        } catch (error) {
            console.error(error);
            response.status(500);
            return response.send(error);
        }
    })

router.route("/:id/token")
    .put(async (request, response) => {
        try {
            // Get access token.
            let accessTokenRes = await refreshAccessToken(request.body.twitchAuthCode);

            // Get user profile.
            let userRes = await getProfile(accessTokenRes.access_token);

            // Get approved bots.
            let profile = userRes.data[0];
            let twitchUser = getAuthenticatedTwitchUserId(request);

            // Validate that the token being updated is owned by channel
            if (twitchUser !== request.params.id || profile.id !== request.params.id) {
                response.status(403);
                return response.send("Invalid user");
            }

            let bot = await Bots.findOne({twitchChannelId: request.params.id}).exec();
            bot.accessToken = accessTokenRes.access_token;
            bot.refreshToken = accessTokenRes.refresh_token;
            await Bots.findByIdAndUpdate(bot._id, bot);
            response.status(204);
            return response.send();
        } catch (error) {
            console.error(error);
            response.status(500);
            return response.send(error);
        }
    })
    .get(async (request, response) => {
        let bot = await Bots.findOne({twitchChannelId: request.params.id}).exec();
        
        // Check auth token
        try {
            try {
                await validateAccessToken(bot.accessToken);
                return response.json({
                    valid: true
                });
            } catch (error) {
                console.error("STALE ACCESS TOKEN");
                // Refresh token on failure to validate
                let refresh = await refreshAccessToken(bot.refreshToken);
                bot.accessToken = refresh.access_token;
                bot.refreshToken = refresh.refresh_token;
                await Bots.findByIdAndUpdate(bot._id, bot);
                console.log("REFRESHED TOKEN SUCCESSFULLY");

                return response.json({
                    valid: true
                });
            }
        } catch (error) {
            return response.json({
                valid: false
            });
        }
    })

router.route("/:id/state")
    .get(async (request, response) => {
        let twitchUser = getAuthenticatedTwitchUserId(request);
        if (twitchUser !== request.params.id && !authenticatedUserHasRole(request, "TWITCH_ADMIN")) {
            response.status(403);
            return response.send("Insufficient privileges");
        }

        try {
            let containerRunning = await isContainerRunning(`cbd-bot-${request.params.id}`);

            return response.json(
                {
                    created: true,
                    running: containerRunning
                }
            )
        } catch (error) {
            if (error.response && error.response.state === 404) {
                return response.json(
                    {
                        created: false,
                        running: false
                    }
                );
            } else {
                response.status(500);
                return response.send(error);
            }
        }
    })
    .put(async (request, response) => {
        let twitchUser = getAuthenticatedTwitchUserId(request);
        if (twitchUser !== request.params.id && !authenticatedUserHasRole(request, "TWITCH_ADMIN")) {
            response.status(403);
            return response.send("Insufficient privileges");
        }
        
        try {
            // Stop, delete, rebuild container, and then start it to guarantee that it's always the newest version.
            if (request.body.newState === "start" || request.body.newState === "restart") {
                await deleteBotContainer(`cbd-bot-${request.params.id}`);
                await createBotContainer(request.params.id, `cbd-bot-${request.params.id}`);
                await changeContainerState(`cbd-bot-${request.params.id}`, "start");
            } else if (request.body.newState === "stop") {
                await deleteBotContainer(`cbd-bot-${request.params.id}`);
            }

            return response.send();
        } catch (error) {
            if (error.response && error.response.state === 404) {
                response.status(404);
                return response.send(error);
            } else {
                response.status(500);
                console.log("Failed to start container: " + error);
                return response.send(error);
            }
        }
    });

router.route("/:id/media/:pool")
    .put(async (request, response) => {
        let twitchUser = getAuthenticatedTwitchUserId(request);
        console.log(twitchUser + " === " + request.params.id + "?");
        if (twitchUser !== request.params.id && !authenticatedUserHasRole(request, "TWITCH_ADMIN")) {
            console.error("USER DOESN'T OWN CHANNEL OR HAVE ADMIN PRIVILEGES");
            response.status(403);
            return response.send("Insufficient privileges");
        }

        try {
            let bot = await Bots.findOne({twitchChannelId: request.params.id});
            if (request.params.pool === "video") {
                bot.videoPool = request.body;
            } else if (request.params.pool === "audio") {
                bot.audioPool = request.body;
            }
            await Bots.updateOne({twitchChannelId: request.params.id}, bot);
            return response.json(bot);
        } catch (error) {
            console.error(error);
            response.status(500);
            return response.send(error);
        }
    })

router.route("/:id/raid-config")
    .put(async (request, response) => {
        let twitchUser = getAuthenticatedTwitchUserId(request);
        if (twitchUser !== request.params.id && !authenticatedUserHasRole(request, "TWITCH_ADMIN")) {
            console.error("USER DOESN'T OWN CHANNEL OR HAVE ADMIN PRIVILEGES");
            response.status(403);
            return response.send("Insufficient privileges");
        }

        try {
            let bot = await Bots.findOne({twitchChannelId: request.params.id});
            bot.raidConfig = request.body;
            await Bots.updateOne({twitchChannelId: request.params.id}, bot);
            return response.json(bot);
        } catch (error) {
            console.error(error);
            response.status(500);
            return response.send(error);
        }
    });

router.route("/:id/bot-user")
    .post(async (request, response) => {
        let twitchUser = getAuthenticatedTwitchUserId(request);
        if (twitchUser !== request.params.id && !authenticatedUserHasRole(request, "TWITCH_ADMIN")) {
            response.status(403);
            return response.send("Insufficient privileges");
        }

        try {
            // Get access token.
            let accessTokenRes = await getAccessToken(request.body.twitchAuthCode);

            // Get user profile.
            let userRes = await getProfile(accessTokenRes.access_token);
            let profile = userRes.data[0];

            // Create body
            let twitchUser = profile.login;
            let twitchId = parseInt(profile.id);
            let accessToken = accessTokenRes.access_token;
            let refreshToken = accessTokenRes.refresh_token;

            let bot = await Bots.findOne({twitchChannelId: request.params.id}).exec();

            bot.botUser = {
                twitchUser,
                twitchId,
                accessToken,
                refreshToken
            };

            bot.save();
            
            return response.json(bot);
        } catch (error) {
            console.error(error);
            response.status(500);
            return response.send(error);
        }
    })

module.exports = router;
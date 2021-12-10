const express = require('express');
const router = express.Router();
const RaidConfigs = require('../models/raidConfigs');

import {authenticatedUserHasRole, authenticatedUserHasAccessToChannel} from '../utils/SecurityHelper';

router.route("/")
    .get(async (request, response) => {
        try {
            let {twitchChannel} = request.query;
            let results = await RaidConfigs.find({twitchChannel}, null, {sort: {name: 1}});

            return response.json(results);
        } catch (error) {
            return response.status(500).send();
        }
    })
    .post(async (request, response) => {
        if (!authenticatedUserHasAccessToChannel(request, request.body.twitchChannel) && !authenticatedUserHasRole(request, "TWITCH_ADMIN")) {
            response.status(403);
            return response.send("Authenticated user doesn't have access to this channel's assets.")
        }

        try {
            let result = await RaidConfigs.create(request.body);

            return response.json(result);
        } catch (error) {
            console.error("ERROR: " + error);
            return response.status(500).send();
        }
    });

router.route("/:id")
    .get(async (request, response) => {
        try {
            let {id} = request.params;
            let result = await RaidConfigs.findById(id);

            return response.json(result);
        } catch (error) {
            return response.status(500).send();
        }
    })
    .put(async (request, response) => {
        if (!authenticatedUserHasAccessToChannel(request, request.body.twitchChannel) && !authenticatedUserHasRole(request, "TWITCH_ADMIN")) {
            response.status(403);
            return response.send("Authenticated user doesn't have access to this channel's assets.")
        }

        try {
            let {id} = request.params;
            let result = await RaidConfigs.updateOne({_id: id}, request.body);
            
            return response.json(result);
        } catch (error) {
            return response.status(500).send();
        }
    })
    .delete(async (request, response) => {
        try {
            let {id} = request.params;
            let result = await RaidConfigs.findById(id);

            if (!authenticatedUserHasAccessToChannel(request, result.twitchChannel) && !authenticatedUserHasRole(request, "TWITCH_ADMIN")) {
                response.status(403);
                return response.send("Authenticated user doesn't have access to this channel's assets.")
            }

            result = await RaidConfigs.deleteOne({_id: id}, request.body);
            
            return response.json(result);
        } catch (error) {
            return response.status(500).send();
        }
    });

module.exports = router;
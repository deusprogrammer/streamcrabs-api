const express = require('express');
var router = express.Router();
var Configs = require('../models/configs');

import {authenticatedUserHasRole} from '../utils/SecurityHelper';

router.route("/")
    .get(async (request, response) => {
        if (!authenticatedUserHasRole(request, "TWITCH_ADMIN")) {
            response.status(403);
            return response.send("Insufficient privileges");
        }

        try {
            let configs = await Configs.find({});
            return response.json(configs);
        } catch (error) {
            console.error(error);
            response.status(500);
            return response.send(error);
        }
    })
    .post(async (request, response) => {
        if (!authenticatedUserHasRole(request, "TWITCH_ADMIN")) {
            response.status(403);
            return response.send("Insufficient privileges");
        }

        try {
            Configs.create(request.body);
            return response.json(request.body);
        } catch (error) {
            console.error(error);
            response.status(500);
            return response.send(error);
        }
    })

router.route("/:id")
    .put(async (request, response) => {
        if (!authenticatedUserHasRole(request, "TWITCH_ADMIN")) {
            response.status(403);
            return response.send("Insufficient privileges");
        }

        try {
            let config = await Configs.findOneAndUpdate({name: request.params.id}, request.body);
            return response.json(config);
        } catch (error) {
            console.error(error);
            response.status(500);
            return response.send(error);
        }
    })

module.exports = router;
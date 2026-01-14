"use strict";

/**
 * live-lecture router
 */

const { createCoreRouter } = require("@strapi/strapi").factories;

module.exports = createCoreRouter("api::live-lecture.live-lecture", {
    config: {
        sendLectureReminders: {
            policies: [],
        },
    },
    routes: [
        {
            method: "POST",
            path: "/live-lectures/send-reminders",
            handler: "live-lecture.sendLectureReminders",
        },
    ],
});

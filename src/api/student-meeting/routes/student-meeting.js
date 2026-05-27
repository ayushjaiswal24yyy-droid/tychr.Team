"use strict";

const { createCoreRouter } = require("@strapi/strapi").factories;

module.exports = createCoreRouter(
  "api::student-meeting.student-meeting",
  {
    routes: [
      {
        method: "GET",
        path: "/student-meetings/my-plans",
        handler: "student-meeting.myPlans",
      },
      {
        method: "GET",
        path: "/student-meetings/my-meetings",
        handler: "student-meeting.myMeetings",
      },
      {
        method: "POST",
        path: "/student-meetings/schedule",
        handler: "student-meeting.schedule",
      },
      {
        method: "POST",
        path: "/student-meetings/:id/complete",
        handler: "student-meeting.complete",
      },
      {
        method: "POST",
        path: "/student-meetings/:id/interrupt",
        handler: "student-meeting.interrupt",
      },
      {
        method: "POST",
        path: "/student-meetings/:id/join",
        handler: "student-meeting.join",
      }
    ],
  }
);
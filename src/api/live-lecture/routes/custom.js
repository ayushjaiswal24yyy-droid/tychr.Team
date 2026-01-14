"use strict";

module.exports = {
  routes: [
    {
      method: "POST",
      path: "/live-lectures/send-reminders",
      handler: "live-lecture.sendLectureReminders",
      config: {
       policies: [],
      },
    },
  ],
};

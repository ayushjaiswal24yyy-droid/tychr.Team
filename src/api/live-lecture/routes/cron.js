"use strict";

module.exports = {
  routes: [
    {
      method: "POST",
      path: "/cron/send-lecture-reminders",
      handler: "live-lecture.sendLectureReminders",
      config: {
        policies: [], 
      },
    },
  ],
};

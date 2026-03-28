"use strict";

module.exports = {
  routes: [
    {
      method: "POST",
      path: "/cron/send-lecture-reminders",
      handler: "live-lecture.sendLectureReminders",
      config: {
        auth: false,
      },
    },
    {
      method: "POST",
      path: "/cron/sync-teams-recordings",
      handler: "live-lecture.syncRecordings",
      config: {
        auth: false,
      },
    },
    
  ],
};

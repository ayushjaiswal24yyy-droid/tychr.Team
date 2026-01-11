'use strict';

module.exports = {
  routes: [
    {
      method: "POST",
      path: "/cron/send-campaigns",
      handler: "cron.sendScheduled",
       config: {
        policies: [],
      },
    },
  ],
};

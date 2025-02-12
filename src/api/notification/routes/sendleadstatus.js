module.exports = {
  routes: [
    {
      method: "POST",
      path: "/notification/sendleadstatus",
      handler: "sendleadstatus.sendStatusEmail",
    },
  ],
};

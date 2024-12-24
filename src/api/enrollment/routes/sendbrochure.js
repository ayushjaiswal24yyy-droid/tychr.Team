module.exports = {
  routes: [
    {
      method: "POST",
      path: "/enrollment/sendbrochure",
      handler: "sendbrochure.sendBrochureEmail",
    },
  ],
};

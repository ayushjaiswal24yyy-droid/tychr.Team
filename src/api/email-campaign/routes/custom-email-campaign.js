module.exports = {
  routes: [
    {
      method: "POST",
      path: "/email-campaigns/:id/send-test",
      handler: "email-campaign.sendTest",
      config: {
        policies: [],
      },
    },
    {
      method: "POST",
      path: "/email-campaigns/:id/send",
      handler: "email-campaign.sendCampaign",
      config: {
        policies: [],
      },
    }
  ],
};

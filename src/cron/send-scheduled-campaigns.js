'use strict';

module.exports = {
  async sendScheduledCampaigns({ strapi }) {
    strapi.log.info("Cron tick: checking scheduled campaigns");

    const now = new Date();

    const campaigns = await strapi.entityService.findMany(
      "api::email-campaign.email-campaign",
      {
        filters: {
          status: "scheduled",
          scheduleAt: { $lte: now },
        },
        populate: ["htmlTemplate", "webinar"],
      }
    );

    for (const campaign of campaigns) {
      try {
        await strapi.entityService.update(
          "api::email-campaign.email-campaign",
          campaign.id,
          { data: { status: "sending" } }
        );

        await strapi
          .controller("api::email-campaign.email-campaign")
          .sendCampaign({ params: { id: campaign.id } });

      } catch (err) {
        strapi.log.error(
          `Failed to send scheduled campaign ${campaign.id}`,
          err
        );
      }
    }
  },
};

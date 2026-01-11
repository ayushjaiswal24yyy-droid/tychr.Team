'use strict';

module.exports = {
  /**
   * Runs every minute
   */
  async sendScheduledCampaigns({ strapi }) {
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
        // mark as sending (prevents double send)
        await strapi.entityService.update(
          "api::email-campaign.email-campaign",
          campaign.id,
          { data: { status: "sending" } }
        );

        // reuse existing logic
        await strapi
          .controller("api::email-campaign.email-campaign")
          .sendCampaign({
            params: { id: campaign.id },
          });

      } catch (err) {
        strapi.log.error(
          `Failed to send scheduled campaign ${campaign.id}`,
          err
        );

        await strapi.entityService.update(
          "api::email-campaign.email-campaign",
          campaign.id,
          { data: { status: "failed" } }
        );
      }
    }
  },
};

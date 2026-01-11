'use strict';

module.exports = {
  async sendScheduled(ctx) {
    // 🔐 Simple security check
    const secret = ctx.request.headers['x-cron-key'];

    if (secret !== process.env.CRON_SECRET) {
      return ctx.unauthorized('Invalid cron key');
    }

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

    let processed = 0;

    for (const campaign of campaigns) {
      try {
        // lock campaign
        await strapi.entityService.update(
          "api::email-campaign.email-campaign",
          campaign.id,
          { data: { status: "sending" } }
        );

        await strapi
          .controller("api::email-campaign.email-campaign")
          .sendCampaign({ params: { id: campaign.id } });

        processed++;
      } catch (err) {
        strapi.log.error(
          `Scheduled send failed for campaign ${campaign.id}`,
          err
        );
      }
    }

    return {
      ok: true,
      processed,
    };
  },
};

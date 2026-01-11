'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController(
  'api::email-campaign.email-campaign',
  ({ strapi }) => ({
    async sendTest(ctx) {
      const { id } = ctx.params;
      const { email } = ctx.request.body;

      if (!email) {
        return ctx.badRequest("Test email is required");
      }

      const campaign = await strapi.entityService.findOne(
        'api::email-campaign.email-campaign',
        id,
        { populate: ['htmlTemplate'] }
      );

      if (!campaign) {
        return ctx.notFound("Campaign not found");
      }

      const file = campaign.htmlTemplate;
      if (!file?.url) {
        return ctx.badRequest("HTML template missing");
      }

      const html = await fetch(file.url).then(res => res.text());

      const processedHtml = html
        .replace(/{{firstName}}/g, "Test User")
        .replace(/{{webinarName}}/g, campaign.name);

      await strapi.plugin('email').service('email').send({
        to: email,
        subject: `[TEST] ${campaign.subject}`,
        html: processedHtml,
      });

      return { ok: true };
    },
  })
);

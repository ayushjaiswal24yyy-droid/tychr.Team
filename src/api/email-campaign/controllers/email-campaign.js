'use strict';

const { createCoreController } = require('@strapi/strapi').factories;
const axios = require("axios");

function renderTemplate(html, context) {
  return html.replace(/{{\s*(\w+)\s*}}/g, (_, key) => {
    return context[key] ?? "";
  });
}
function buildTemplateContext({ lead, webinar, campaign }) {
  const start = new Date(webinar.startDate);
  const end = webinar.endDate ? new Date(webinar.endDate) : null;

  return {
    // Lead
    firstName: lead.firstName || "",
    lastName: lead.lastName || "",
    email: lead.email,

    // Webinar
    webinarName: webinar.name,

    startDate: start.toLocaleDateString(),
    startTime: start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    endDate: end ? end.toLocaleDateString() : "",
    timezone: webinar.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,

    joinLink: webinar.joinLink || "",

    // Campaign
    fromName: campaign.fromName || "Team",
  };
}


module.exports = createCoreController(
  'api::email-campaign.email-campaign',
  ({ strapi }) => ({

    // =========================
    // SEND TEST EMAIL
    // =========================
    async sendTest(ctx) {
      const { id } = ctx.params;
      const { email } = ctx.request.body;

      if (!email) {
        return ctx.badRequest("Test email is required");
      }

      const campaign = await strapi.entityService.findOne(
        'api::email-campaign.email-campaign',
        id,
        { populate: ['htmlTemplate', 'webinar'] }
      );

      if (!campaign) return ctx.notFound("Campaign not found");
      if (!campaign.htmlTemplate?.url) {
        return ctx.badRequest("HTML template missing");
      }

      const { data: html } = await axios.get(campaign.htmlTemplate.url);

      const context = buildTemplateContext({
        lead: { email, firstName: "Test" },
        webinar: campaign.webinar,
        campaign,
      });

      const rendered = renderTemplate(html, context);


      await strapi.plugin('email').service('email').send({
        to: email,
        subject: `[TEST] ${campaign.subject}`,
        html: rendered,
      });

      return { ok: true };
    },

    // =========================
    // SEND FULL CAMPAIGN
    // =========================
    async sendCampaign(ctx) {
      const { id } = ctx.params;

      const campaign = await strapi.entityService.findOne(
        "api::email-campaign.email-campaign",
        id,
        { populate: ["htmlTemplate", "webinar"] }
      );

      if (!campaign) return ctx.notFound();
      if (campaign.status === "sent") {
        return ctx.badRequest("Campaign already sent");
      }



      const leads = await strapi.entityService.findMany(
        "api::lead.lead",
        {
          filters: {
            webinar: campaign.webinar.id,
            status: "active",
          },
        }
      );

      if (!leads.length) {
        return ctx.badRequest("No active leads found");
      }

      const { data: html } = await axios.get(campaign.htmlTemplate.url);

      let sent = 0;
      let failed = 0;

      for (const lead of leads) {
        try {
          const context = buildTemplateContext({
            lead,
            webinar: campaign.webinar,
            campaign,
          });

          const rendered = renderTemplate(html, context);


          await strapi.plugin("email").service("email").send({
            to: lead.email,
            subject: campaign.subject,
            html: rendered,
          });

          sent++;

          await strapi.entityService.update(
            "api::lead.lead",
            lead.id,
            {
              data: {
                lastEmailedAt: new Date(),
                emailCount: (lead.emailCount || 0) + 1,
              },
            }
          );
        } catch (err) {
          failed++;
          strapi.log.error("Email failed:", lead.email, err);
        }
      }

      await strapi.entityService.update(
        "api::email-campaign.email-campaign",
        id,
        {
          data: {
            status: "sent",
            sentCount: sent,
            failedCount: failed,
          },
        }
      );

      return { sent, failed };
    },
  })
);

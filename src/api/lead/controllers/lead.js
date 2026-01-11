'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::lead.lead', ({ strapi }) => ({
  async importCSV(ctx) {
    const { webinarId, leads } = ctx.request.body;

    if (!webinarId || !Array.isArray(leads)) {
      return ctx.badRequest("Invalid payload");
    }

    if (!leads.length) {
      return ctx.badRequest("No leads provided");
    }

    // Validate again (never trust frontend fully)
    const cleaned = [];
    const seen = new Set();

    for (const lead of leads) {
      const email = lead.email?.trim().toLowerCase();
      if (!email) continue;
      if (!/^\S+@\S+\.\S+$/.test(email)) continue;
      if (seen.has(email)) continue;

      seen.add(email);

      cleaned.push({
        email,
        firstName: lead.firstName || null,
        lastName: lead.lastName || null,
        status: "active",
        source: "csv",
       webinar: { connect: [webinarId] },

      });
    }

    if (!cleaned.length) {
      return ctx.badRequest("No valid leads after validation");
    }

    // Deduplicate against DB
    const existing = await strapi.entityService.findMany(
      "api::lead.lead",
      {
        filters: {
          webinar: webinarId,
          email: { $in: cleaned.map(l => l.email) },
        },
        fields: ["email"],
      }
    );

    const existingEmails = new Set(existing.map(l => l.email));

    const finalLeads = cleaned.filter(
      l => !existingEmails.has(l.email)
    );

    await strapi.entityService.createMany(
      "api::lead.lead",
      { data: finalLeads }
    );

    return {
      imported: finalLeads.length,
      skipped: leads.length - finalLeads.length,
    };
  },
}));

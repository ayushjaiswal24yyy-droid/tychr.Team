'use strict';

const { createCoreController } = require('@strapi/strapi').factories;
const csv = require('csvtojson');

module.exports = createCoreController('api::lead.lead', ({ strapi }) => ({
  async importCSV(ctx) {
    const { webinarId, fileId } = ctx.request.body;

    if (!webinarId || !fileId) {
      return ctx.badRequest("webinarId and fileId are required");
    }

    const file = await strapi.entityService.findOne(
      "plugin::upload.file",
      fileId
    );

    if (!file) {
      return ctx.badRequest("Invalid file");
    }

    // ✅ READ FILE VIA PROVIDER (NOT URL)
    let csvText;
    try {
      const provider = strapi.plugin("upload").provider;
      const stream = await provider.getStream(file);

      const chunks = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      csvText = Buffer.concat(chunks).toString("utf-8");
    } catch (err) {
      strapi.log.error("CSV READ ERROR:", err);
      return ctx.badRequest("Unable to read CSV file");
    }

    let rows;
    try {
      rows = await csv().fromString(csvText);
    } catch {
      return ctx.badRequest("Invalid CSV format");
    }

    if (!rows.length) {
      return ctx.badRequest("CSV is empty");
    }

    const emails = new Set();
    const leadsToCreate = [];

    for (const row of rows) {
      const email = row.email?.trim().toLowerCase();
      if (!email) continue;
      if (!/^\S+@\S+\.\S+$/.test(email)) continue;
      if (emails.has(email)) continue;

      emails.add(email);

      leadsToCreate.push({
        email,
        firstName: row.firstName || null,
        lastName: row.lastName || null,
        status: "active",
        source: "csv",
        webinar: webinarId,
      });
    }

    if (!leadsToCreate.length) {
      return ctx.badRequest("No valid leads found");
    }

    const existing = await strapi.entityService.findMany(
      "api::lead.lead",
      {
        filters: {
          webinar: webinarId,
          email: { $in: leadsToCreate.map(l => l.email) },
        },
        fields: ["email"],
      }
    );

    const existingEmails = new Set(existing.map(l => l.email));
    const finalLeads = leadsToCreate.filter(
      l => !existingEmails.has(l.email)
    );

    await strapi.entityService.createMany(
      "api::lead.lead",
      { data: finalLeads }
    );

    return {
      imported: finalLeads.length,
      skipped: rows.length - finalLeads.length,
    };
  },
}));

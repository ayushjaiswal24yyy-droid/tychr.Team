'use strict';

const { createCoreController } = require('@strapi/strapi').factories;
const csv = require('csvtojson');
const axios = require('axios');

module.exports = createCoreController('api::lead.lead', ({ strapi }) => ({
  async importCSV(ctx) {
    const { webinarId, fileId } = ctx.request.body;

    if (!webinarId || !fileId) {
      return ctx.badRequest("webinarId and fileId are required");
    }

    // 1️⃣ Fetch uploaded file
    const file = await strapi.entityService.findOne(
      "plugin::upload.file",
      fileId
    );

    if (!file?.url) {
      return ctx.badRequest("Invalid file");
    }

    // 2️⃣ Download CSV (axios instead of fetch)
    let csvText;
    try {
      const response = await axios.get(file.url);
      csvText = response.data;
    } catch (err) {
      strapi.log.error(err);
      return ctx.badRequest("Unable to read CSV file");
    }

    // 3️⃣ Parse CSV
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

    // 4️⃣ Deduplicate existing leads
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

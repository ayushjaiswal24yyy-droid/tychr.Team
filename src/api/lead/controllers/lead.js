'use strict';

const { createCoreController } = require('@strapi/strapi').factories;
const csv = require('csvtojson');
const fs = require('fs');

module.exports = createCoreController('api::lead.lead', ({ strapi }) => ({
  async importCSV(ctx) {
    const { webinarId } = ctx.request.body;
    const file = ctx.request.files?.file;

    if (!webinarId) {
      return ctx.badRequest("webinarId is required");
    }

    if (!file) {
      return ctx.badRequest("CSV file is required");
    }

    // normalize file (array vs object)
    const csvFile = Array.isArray(file) ? file[0] : file;

    let csvText;
    try {
      csvText = fs.readFileSync(csvFile.path, "utf-8");
    } catch (err) {
      strapi.log.error("FILE READ ERROR:", err);
      return ctx.badRequest("Unable to read CSV file");
    }

    let rows;
    try {
      rows = await csv().fromString(csvText);
    } catch (err) {
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

    // remove duplicates already in DB
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

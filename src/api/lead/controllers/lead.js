'use strict';

const { createCoreController } = require('@strapi/strapi').factories;
const csv = require('csvtojson');

module.exports = createCoreController('api::lead.lead', ({ strapi }) => ({
  async importCSV(ctx) {
    const { webinarId } = ctx.request.body;

    if (!webinarId) {
      return ctx.badRequest('webinarId is required');
    }

    const file = ctx.request.files?.file;
    if (!file) {
      return ctx.badRequest('CSV file is required');
    }

    // 1️⃣ Parse CSV
    let rows;
    try {
      rows = await csv().fromFile(file.path);
    } catch (err) {
      return ctx.badRequest('Invalid CSV format');
    }

    if (!rows.length) {
      return ctx.badRequest('CSV is empty');
    }

    // 2️⃣ Normalize & validate
    const emails = new Set();
    const leadsToCreate = [];

    for (const row of rows) {
      const email = row.email?.trim().toLowerCase();

      if (!email) continue;
      if (!/^\S+@\S+\.\S+$/.test(email)) continue;

      // avoid duplicate emails in same CSV
      if (emails.has(email)) continue;
      emails.add(email);

      leadsToCreate.push({
        email,
        firstName: row.firstName?.trim() || null,
        lastName: row.lastName?.trim() || null,
        status: 'active',
        source: 'csv',
        webinar: webinarId,
      });
    }

    if (!leadsToCreate.length) {
      return ctx.badRequest('No valid leads found');
    }

    // 3️⃣ Remove existing leads for same webinar
    const existingLeads = await strapi.entityService.findMany(
      'api::lead.lead',
      {
        filters: {
          webinar: webinarId,
          email: {
            $in: leadsToCreate.map(l => l.email),
          },
        },
        fields: ['email'],
      }
    );

    const existingEmails = new Set(
      existingLeads.map(l => l.email)
    );

    const finalLeads = leadsToCreate.filter(
      l => !existingEmails.has(l.email)
    );

    // 4️⃣ Bulk insert
    await strapi.entityService.createMany(
      'api::lead.lead',
      { data: finalLeads }
    );

    return {
      imported: finalLeads.length,
      skipped: rows.length - finalLeads.length,
    };
  },
}));

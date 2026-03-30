'use strict';
const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::individual-user.individual-user', ({ strapi }) => ({
  async myStudents(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();

    // Get all offerings created by this user
    const offerings = await strapi.db
      .query('api::third-party-offering.third-party-offering')
      .findMany({
        where: { created_by_user: { id: user.id } },
        select: ['id'],
      });

    if (!offerings.length) return ctx.send({ data: [] });

    const offeringIds = offerings.map(o => o.id);

    // Get accepted applicants across those offerings
    const applicants = await strapi.db
      .query('api::tp-applicant.tp-applicant')
      .findMany({
        where: {
          is_accepted: true,
          third_party_offering: { id: { $in: offeringIds } },
        },
        populate: {
          applied_by: {
            select: ['id', 'fullName', 'username', 'email'],
          },
        },
      });

    // Deduplicate by student id
    const seen = new Set();
    const students = applicants
      .map(a => {
        const s = a.applied_by;
        if (!s || seen.has(s.id)) return null;
        seen.add(s.id);
        return {
          id: s.id,
          fullName: s.fullName || s.username,
          email: s.email,
        };
      })
      .filter(Boolean);

    return ctx.send({ data: students });
  },
}));
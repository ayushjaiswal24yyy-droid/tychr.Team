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
  async myApplicants(ctx) {
  const user = ctx.state.user;
  if (!user) return ctx.unauthorized();

  const { region, service, year, status } = ctx.query;

  const offerings = await strapi.db
    .query('api::third-party-offering.third-party-offering')
    .findMany({
      where: { created_by_user: { id: user.id } },
      select: ['id'],
    });

  if (!offerings.length) return ctx.send({ data: [] });

  const offeringIds = offerings.map(o => o.id);

  // Build dynamic where clause
  const where = {
    third_party_offering: { id: { $in: offeringIds } },
  };

  if (status && status !== 'all') {
    where.is_accepted = status === 'accepted';
  }

  if (region && region !== 'all') {
    where.third_party_offering = {
      ...where.third_party_offering,
      Location: { $eq: region },
    };
  }

  if (service && service !== 'all') {
    where.third_party_offering = {
      ...where.third_party_offering,
      title: { $contains: service },
    };
  }

  if (year && year !== 'all') {
    where.third_party_offering = {
      ...where.third_party_offering,
      startDate: { $gte: `${year}-01-01`, $lte: `${year}-12-31` },
    };
  }

  const applicants = await strapi.db
    .query('api::tp-applicant.tp-applicant')
    .findMany({
      where,
      populate: {
        applied_by: true,
        third_party_offering: { select: ['id', 'title'] },
      },
    });

  return ctx.send({ data: applicants });
},
}));
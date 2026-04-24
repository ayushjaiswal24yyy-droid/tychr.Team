'use strict';

const { createCoreController } = require('@strapi/strapi').factories;
const { getRecommendations } = require('../services/recommendation');

module.exports = createCoreController(
  'api::third-party-offering.third-party-offering',
  ({ strapi }) => ({
    async recommend(ctx) {
      try {
        const userId = ctx.state?.user?.id || 1; // Fallback to user ID 1 for testing

        const results = await getRecommendations(userId);

        if (Array.isArray(results) && results.length > 0) {
          return ctx.send({ data: results });
        }

        // Fallback if recommendation yields nothing
        const fallbackOfferings = await strapi.entityService.findMany(
          'api::third-party-offering.third-party-offering',
          {
            publicationState: 'live',
            limit: 10
          }
        );
        return ctx.send({ data: Array.isArray(fallbackOfferings) ? fallbackOfferings : [] });

      } catch (err) {
        console.error('RECOMMEND CONTROLLER ERROR:', err);
        try {
          const fallbackOfferings = await strapi.entityService.findMany(
            'api::third-party-offering.third-party-offering',
            { limit: 10 }
          );
          return ctx.send({ data: Array.isArray(fallbackOfferings) ? fallbackOfferings : [] });
        } catch (fallbackErr) {
          return ctx.send({ data: [] });
        }
      }
    }
  })
);

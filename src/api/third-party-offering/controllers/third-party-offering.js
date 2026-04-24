'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController(
  'api::third-party-offering.third-party-offering',
  ({ strapi }) => ({
    async find(ctx) {
      try {
        const offerings = await strapi.entityService.findMany(
          'api::third-party-offering.third-party-offering',
          {
            publicationState: 'live',
            sort: { createdAt: 'desc' },
            populate: '*',
          }
        );

        const safeOfferings = Array.isArray(offerings) ? offerings : [];
        const validatedOfferings = safeOfferings.map((offering) => ({
          ...offering,
          title: offering?.title ?? null,
          description: offering?.description ?? null,
          category: offering?.category ?? null,
          skill_tags: offering?.skill_tags ?? null,
          activity_type: offering?.activity_type ?? null,
        }));
        console.log('THIRD PARTY OFFERINGS FIND COUNT:', safeOfferings.length);

        return ctx.send({ data: validatedOfferings });
      } catch (err) {
        console.error('THIRD PARTY OFFERINGS FIND ERROR:', err);
        return ctx.send({ data: [] });
      }
    },


    async findOne(ctx) {
      try {
        const { id } = ctx.params;
        const offering = await strapi.db
          .query('api::third-party-offering.third-party-offering')
          .findOne({
            where: {
              id,
              publishedAt: {
                $notNull: true,
              },
            },
            populate: true,
          });

        return ctx.send({ data: offering || null });
      } catch (err) {
        strapi.log.error('THIRD PARTY OFFERINGS FIND ONE ERROR:', err);
        return ctx.send({ data: null });
      }
    },

    async recommend(ctx) {
      try {
        return ctx.send({ data: [] });
      } catch (err) {
        console.error('THIRD PARTY OFFERINGS RECOMMEND ERROR:', err);
        return ctx.send({ data: [] });
      }
    }
  })
);


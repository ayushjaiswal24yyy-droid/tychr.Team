'use strict';

/**
 * tp-applicant controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

// Inline helpers to avoid external dependency on ../../third-party-offering/utils/format
function formatOfferingSummary(offering) {
  if (!offering) return { id: null, attributes: {} };
  if (offering.attributes) return offering;
  const { id, ...rest } = offering;
  return { id, attributes: rest };
}

const offeringResponseFields = ['id', 'title', 'publishedAt'];

function formatApplicationResponse(application) {
  if (!application?.third_party_offering) return application;

  return {
    ...application,
    third_party_offering: formatOfferingSummary(application.third_party_offering),
  };
}

module.exports = createCoreController('api::tp-applicant.tp-applicant', ({ strapi }) => ({
  async create(ctx) {
    try {
      const user = ctx.state?.user;
      if (!user?.id) {
        return ctx.unauthorized('You must be logged in to apply to an offering');
      }

      const inputData = ctx.request.body?.data;
      if (!inputData || typeof inputData !== 'object' || Array.isArray(inputData)) {
        return ctx.badRequest('Request body must include a data object');
      }

      const offeringId = inputData.third_party_offering;
      if (!offeringId) {
        return ctx.badRequest('third_party_offering is required');
      }

      const offering = await strapi.entityService.findOne(
        'api::third-party-offering.third-party-offering',
        offeringId,
        { fields: ['id', 'publishedAt'] }
      );

      if (!offering || !offering.publishedAt) {
        return ctx.notFound('Offering not found');
      }

      const existingApplications = await strapi.entityService.findMany(
        'api::tp-applicant.tp-applicant',
        {
          filters: {
            applied_by: user.id,
            third_party_offering: offeringId,
          },
          limit: 1,
        }
      );

      if (existingApplications.length > 0) {
        return ctx.badRequest('You have already applied to this offering');
      }

      const application = await strapi.entityService.create(
        'api::tp-applicant.tp-applicant',
        {
          data: {
            third_party_offering: offeringId,
            applied_by: user.id,
            is_accepted: false,
          },
          populate: {
            applied_by: {
              fields: ['id', 'fullName', 'username', 'email'],
            },
            third_party_offering: {
              fields: offeringResponseFields,
              populate: {
                tasks: true,
                college_tag: true,
              },
            },
          },
        }
      );

      return ctx.send({ data: formatApplicationResponse(application) });
    } catch (err) {
      console.error('TP APPLICANT CREATE ERROR:', err);
      return ctx.badRequest('Failed to apply to offering');
    }
  },

  async update(ctx) {
    try {
      const user = ctx.state?.user;
      if (!user?.id) {
        return ctx.unauthorized('You must be logged in to update an application');
      }

      const { id } = ctx.params;
      const inputData = ctx.request.body?.data;
      if (!inputData || typeof inputData !== 'object' || Array.isArray(inputData)) {
        return ctx.badRequest('Request body must include a data object');
      }

      const existingApplication = await strapi.entityService.findOne(
        'api::tp-applicant.tp-applicant',
        id,
        {
          populate: {
            third_party_offering: {
              populate: {
                created_by_user: {
                  fields: ['id'],
                },
              },
            },
          },
        }
      );

      if (!existingApplication) {
        return ctx.notFound('Application not found');
      }

      if (existingApplication.third_party_offering?.created_by_user?.id !== user.id) {
        return ctx.forbidden('You can only update applications for your own offerings');
      }

      const data = {};
      if (inputData.is_accepted !== undefined) {
        if (typeof inputData.is_accepted !== 'boolean') {
          return ctx.badRequest('is_accepted must be a boolean');
        }
        data.is_accepted = inputData.is_accepted;
      }

      if (inputData.conversation_id !== undefined) {
        data.conversation_id = inputData.conversation_id;
      }

      if (Object.keys(data).length === 0) {
        return ctx.badRequest('No supported fields provided');
      }

      const application = await strapi.entityService.update(
        'api::tp-applicant.tp-applicant',
        id,
        {
          data,
          populate: {
            applied_by: {
              fields: ['id', 'fullName', 'username', 'email'],
            },
            third_party_offering: {
              fields: offeringResponseFields,
              populate: {
                tasks: true,
                college_tag: true,
              },
            },
          },
        }
      );

      return ctx.send({ data: formatApplicationResponse(application) });
    } catch (err) {
      console.error('TP APPLICANT UPDATE ERROR:', err);
      return ctx.badRequest('Failed to update application');
    }
  },
}));

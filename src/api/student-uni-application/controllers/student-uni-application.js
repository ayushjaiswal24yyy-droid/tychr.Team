'use strict';

/**
 * student-uni-application controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::student-uni-application.student-uni-application', ({ strapi }) => ({
  async create(ctx) {
    const { data } = ctx.request.body;

    const existing = await strapi.entityService.findMany('api::student-uni-application.student-uni-application', {
      filters: {
        student: data.student,
        college: data.college,
        program: data.program,
      },
      limit: 1,
    });

    if (existing.length > 0) {
      console.error('Student has already applied to this college and program');
      return ctx.badRequest('Student has already applied to this college and program');
    }

    return super.create(ctx);
  },
}));
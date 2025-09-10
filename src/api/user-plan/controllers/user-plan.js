'use strict';
const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::user-plan.user-plan', ({ strapi }) => ({
  // Custom method for available mentors
  async getAvailableMentors(ctx) {
    // Get studentId from JWT (recommended for auth/security)
    const studentId = ctx.state.user?.id;
    if (!studentId) {
      return ctx.badRequest('Student ID required'); // Or fallback to ctx.query.studentId if not using JWT
    }
    
    try {
      const mentors = await strapi.service('api::user-plan.user-plan').getAvailableMentors(studentId);
      return { data: mentors };
    } catch (error) {
      return ctx.internalServerError('Error fetching available mentors');
    }
  },
}));
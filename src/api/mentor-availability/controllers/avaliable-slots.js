'use strict';
const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::mentor-availability.mentor-availability', ({ strapi }) => ({
  // Custom method for available slots
  async getAvailableSlots(ctx) {
    const { mentorId, startDate, endDate } = ctx.query;
    if (!mentorId || !startDate || !endDate) {
      return ctx.badRequest('Missing required parameters: mentorId, startDate, endDate');
    }
    
    // Optional: Validate dates (e.g., ISO format)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      return ctx.badRequest('Invalid date format; use YYYY-MM-DD');
    }
    
    try {
      const slots = await strapi.service('api::mentor-availability.mentor-availability').getAvailableSlots(mentorId, startDate, endDate);
      return { data: slots };
    } catch (error) {
      return ctx.internalServerError('Error fetching available slots');
    }
  },
}));
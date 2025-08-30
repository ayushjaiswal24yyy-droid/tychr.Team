'use strict';
const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::student-meeting.student-meeting', ({ strapi }) => ({
  async joinMeeting(ctx) {
    try {
      const { id } = ctx.params;
      console.log(`Joining meeting ID: ${id}`);

      const meeting = await strapi.entityService.findOne('api::student-meeting.student-meeting', id, { 
        populate: ['user_plan'],
        publicationState: 'preview'
      });

      console.log('Found meeting:', meeting ? { id: meeting.id, status: meeting.status, userPlanId: meeting.user_plan?.id } : 'null');

      if (!meeting) {
        return ctx.badRequest('Meeting not found');
      }
      if (meeting.status !== 'scheduled') {
        return ctx.badRequest(`Invalid meeting status: ${meeting.status}`);
      }

      const userPlan = meeting.user_plan;
      if (!userPlan) {
        return ctx.badRequest('User plan not linked to meeting');
      }
      console.log('User plan hours:', userPlan.remaining_hours);

      if (userPlan.remaining_hours < 1) {
        return ctx.badRequest('No hours left');
      }

      // Deduct hour
      const newHours = userPlan.remaining_hours - 1;
      await strapi.entityService.update('api::user-plan.user-plan', userPlan.id, {
        data: { remaining_hours: newHours },
        publicationState: 'preview'
      });
      console.log('Updated user plan hours to:', newHours);

      // Update status to in_progress (not completed yet)
      await strapi.entityService.update('api::student-meeting.student-meeting', id, {
        data: { status: 'in_progress' },
        publicationState: 'preview'
      });
      console.log('Updated meeting status to in_progress');

      // Check meeting link exists
      const meetLink = meeting.link;
      if (!meetLink) {
        return ctx.badRequest('Meeting link not set');
      }
      
      // Return success with meeting link - let frontend handle opening
      console.log('Meeting ready, link:', meetLink);
      return ctx.send({ 
        ok: true, 
        meetingId: id,
        link: meetLink 
      });

    } catch (error) {
      console.error('Error in joinMeeting:', error);
      return ctx.internalServerError(`Join meeting failed: ${error.message}`);
    }
  },
}));
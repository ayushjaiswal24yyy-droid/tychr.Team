'use strict';
const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::student-meeting.student-meeting', ({ strapi }) => ({
  async joinMeeting(ctx) {
    try {
      const { id } = ctx.params;
      console.log(`Joining meeting ID: ${id}`); // Log for debug

      const meeting = await strapi.entityService.findOne('api::student-meeting.student-meeting', id, { 
        populate: ['user_plan'],
        publicationState: 'preview'  // Include drafts if enabled
      });

      console.log('Found meeting:', meeting ? { id: meeting.id, status: meeting.status, userPlanId: meeting.user_plan?.id } : 'null'); // Log meeting details

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
      console.log('User plan hours:', userPlan.remaining_hours); // Log hours

      if (userPlan.remaining_hours < 1) {
        return ctx.badRequest('No hours left');
      }

      // Deduct hour
      const newHours = userPlan.remaining_hours - 1;
      await strapi.entityService.update('api::user-plan.user-plan', userPlan.id, {
        data: { remaining_hours: newHours },
        publicationState: 'preview'  // Add for drafts
      });
      ctx.send({ ok: true, meetingId: id});
      console.log('Updated user plan hours to:', newHours);

      // Update status
      await strapi.entityService.update('api::student-meeting.student-meeting', id, {
        data: { status: 'completed' },
        publicationState: 'preview'  // Add for drafts
      });
      console.log('Updated meeting status to in_progress');

      // Redirect (check link exists)
      const meetLink = meeting.link;
      if (!meetLink) {
        return ctx.badRequest('Meeting link not set');
      }
      console.log('Redirecting to:', meetLink);
      ctx.redirect(meetLink);

    } catch (error) {
      console.error('Error in joinMeeting:', error); // Log full error
      return ctx.internalServerError(`Join meeting failed: ${error.message}`);
    }
  },
}));
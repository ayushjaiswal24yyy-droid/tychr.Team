'use strict';
const { createCoreController } = require('@strapi/strapi').factories;
module.exports = createCoreController('api::student-meeting.student-meeting', ({ strapi }) => ({
  async create(ctx) {
    const { user_plan, date, start_time, end_time, mentor } = ctx.request.body.data;
    // Validate: Check if slot is available (call getAvailableSlots), remaining_hours >=1
    const plan = await strapi.entityService.findOne('api::user-plan.user-plan', user_plan, { populate: '*' });
    if (plan.remaining_hours < 1) return ctx.badRequest('No hours left');
    // Generate meet_link (e.g., custom or integrate Zoom API: `https://your-domain/meet/${randomId}`)
    const meetLink = `https://meet.google.com/join/${Date.now()}`; // Placeholder
    const newMeeting = await super.create(ctx);
    // In lifecycle (src/extensions/student-meeting/strapi-server.js), afterCreate: populate student/mentor from plan if needed
    return newMeeting;
  },
  async joinMeeting(ctx) {
  const { id } = ctx.params;
  const meeting = await strapi.entityService.findOne('api::student-meeting.student-meeting', id, { populate: ['user_plan'] });
  if (!meeting || meeting.status !== 'scheduled') return ctx.badRequest('Invalid meeting');
  if (meeting.user_plan.remaining_hours < 1) return ctx.badRequest('No hours left');
  await strapi.entityService.update('api::user-plan.user-plan', meeting.user_plan.id, {
    data: { remaining_hours: meeting.user_plan.remaining_hours - 1 },
  });
  await strapi.entityService.update('api::student-meeting.student-meeting', id, {
    data: { status: 'in_progress' },
  });
  // Redirect to actual meet_link or return it
  ctx.redirect(meeting.meet_link);
}
}));

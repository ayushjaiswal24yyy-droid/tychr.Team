'use strict';

module.exports = {
  async afterCreate(event) {
    const { result } = event;

    // Fetch full user plan with student + premium_plan + created_by_user
    const userPlan = await strapi.entityService.findOne('api::user-plan.user-plan', result.id, {
      populate: ['student', 'premium_plan.created_by_user'],
    });

    if (!userPlan) return;

    const studentId = userPlan.student?.id;
    const otherPartyId = userPlan.premium_plan?.created_by_user?.id; // mentor or counsellor

    if (!studentId || !otherPartyId) {
      strapi.log.warn(`UserPlan ${result.id}: missing student or mentor/counsellor, skipping DM creation`);
      return;
    }

    // Check if a direct conversation already exists between these two users
    // (edge case: student buys the same plan twice)
    const existing = await strapi.entityService.findMany('api::conversation.conversation', {
      filters: {
        type: 'direct',
        user_plan: { id: result.id },
      },
      limit: 1,
    });

    if (existing.length > 0) return;

    const planType = userPlan.premium_plan?.type; // "mentor" or "counselor"

    // Create the DM conversation
    await strapi.entityService.create('api::conversation.conversation', {
      data: {
        type: 'direct',
        name: null, // DMs don't need a name, frontend derives it from the other participant
        participants: [studentId, otherPartyId],
        user_plan: result.id,
        is_active: true,
        write_access: 'all',
        last_message_at: new Date(),
      },
    });

    strapi.log.info(`DM created for UserPlan ${result.id} (${planType}) between student ${studentId} and party ${otherPartyId}`);
  },
};
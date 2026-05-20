'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::conversation.conversation', ({ strapi }) => ({

  // GET or CREATE a 1:1 tp-chat conversation between third_party_user and student
  async getOrCreateTpChat(ctx) {
    const requesterId = ctx.state.user.id;
    const { studentId, thirdPartyUserId } = ctx.query;

    if (!studentId || !thirdPartyUserId) {
      return ctx.badRequest('studentId and thirdPartyUserId are required');
    }

    const tpId = Number(thirdPartyUserId);
    const sId = Number(studentId);

    // Only the two participants can initiate this chat
    if (requesterId !== tpId && requesterId !== sId) {
      return ctx.forbidden('You are not part of this conversation');
    }

    const convoName = `tp-chat-${tpId}-${sId}`;

    // Check if already exists
    const existing = await strapi.entityService.findMany('api::conversation.conversation', {
      filters: { name: convoName },
      populate: ['participants'],
      limit: 1,
    });

    if (existing.length > 0) {
      return ctx.send({ data: existing[0] });
    }

    // Create new tp-chat conversation
    const convo = await strapi.entityService.create('api::conversation.conversation', {
      data: {
        type: 'direct',
        name: convoName,
        is_active: true,
        write_access: 'all',
        participants: [tpId, sId],
      },
      populate: ['participants'],
    });

    // Notify both users via socket so they auto-join the room
    strapi.io?.to(`user:${tpId}`).emit('conversation:created', { conversation: convo });
    strapi.io?.to(`user:${sId}`).emit('conversation:created', { conversation: convo });

    return ctx.send({ data: convo });
  },
}));

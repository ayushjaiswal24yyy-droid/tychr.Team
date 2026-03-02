'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::message.message', ({ strapi }) => ({

  // ── Send Message ────────────────────────────────────────────────────────────
  async create(ctx) {
    const userId = ctx.state.user.id;
    const { conversationId, content, parentMessageId } = ctx.request.body;

    if (!conversationId) return ctx.badRequest('conversationId is required');
    if (!content && !ctx.request.files) return ctx.badRequest('content or attachment is required');

    // Verify user is participant
    const convo = await strapi.entityService.findOne('api::conversation.conversation', conversationId, {
      populate: ['participants'],
    });

    if (!convo || !convo.is_active) return ctx.notFound('Conversation not found');

    const isParticipant = convo.participants.some((p) => p.id === userId);
    if (!isParticipant) return ctx.forbidden('You are not part of this conversation');

    if (convo.write_access === 'admins_only') {
      // TODO: check if user is admin/tutor
      return ctx.forbidden('Only admins can send messages here');
    }

    // Create message
    const message = await strapi.entityService.create('api::message.message', {
      data: {
        content,
        sender: userId,
        conversation: conversationId,
        parent_message: parentMessageId || null,
        message_type: 'text',
        is_deleted: false,
      },
      populate: ['sender', 'parent_message'],
    });

    // Update conversation last_message_at
    await strapi.entityService.update('api::conversation.conversation', conversationId, {
      data: { last_message_at: new Date() },
    });

    // Emit to all participants in the room
    strapi.io.to(`conversation:${conversationId}`).emit('message:new', {
      conversationId,
      message: sanitizeMessage(message),
    });

    return ctx.send({ data: sanitizeMessage(message) });
  },

  // ── Edit Message ────────────────────────────────────────────────────────────
  async update(ctx) {
    const userId = ctx.state.user.id;
    const { id } = ctx.params;
    const { content } = ctx.request.body;

    const message = await strapi.entityService.findOne('api::message.message', id, {
      populate: ['sender', 'conversation'],
    });

    if (!message) return ctx.notFound('Message not found');
    if (message.sender?.id !== userId) return ctx.forbidden('You can only edit your own messages');
    if (message.is_deleted) return ctx.badRequest('Cannot edit a deleted message');
    if (message.message_type === 'system') return ctx.badRequest('Cannot edit system messages');

    const updated = await strapi.entityService.update('api::message.message', id, {
      data: { content },
      populate: ['sender', 'parent_message'],
    });

    strapi.io.to(`conversation:${message.conversation.id}`).emit('message:edited', {
      conversationId: message.conversation.id,
      message: sanitizeMessage(updated),
    });

    return ctx.send({ data: sanitizeMessage(updated) });
  },

  // ── Delete Message (soft delete) ────────────────────────────────────────────
  async delete(ctx) {
    const userId = ctx.state.user.id;
    const { id } = ctx.params;

    const message = await strapi.entityService.findOne('api::message.message', id, {
      populate: ['sender', 'conversation'],
    });

    if (!message) return ctx.notFound('Message not found');
    if (message.sender?.id !== userId) return ctx.forbidden('You can only delete your own messages');

    await strapi.entityService.update('api::message.message', id, {
      data: { is_deleted: true, content: 'This message was deleted' },
    });

    strapi.io.to(`conversation:${message.conversation.id}`).emit('message:deleted', {
      conversationId: message.conversation.id,
      messageId: id,
    });

    return ctx.send({ data: { id, deleted: true } });
  },

  // ── Get Messages (paginated) ─────────────────────────────────────────────────
  async find(ctx) {
    const userId = ctx.state.user.id;
    const { conversationId, page = 1, pageSize = 30 } = ctx.query;

    if (!conversationId) return ctx.badRequest('conversationId is required');

    // Verify access
    const convo = await strapi.entityService.findOne('api::conversation.conversation', conversationId, {
      populate: ['participants'],
    });

    if (!convo) return ctx.notFound('Conversation not found');

    const isParticipant = convo.participants.some((p) => p.id === userId);
    if (!isParticipant && convo.type !== 'subject_group') {
      return ctx.forbidden('Access denied');
    }

    const messages = await strapi.entityService.findMany('api::message.message', {
      filters: { conversation: { id: conversationId } },
      populate: ['sender', 'parent_message.sender'],
      sort: { createdAt: 'desc' },
      start: (page - 1) * pageSize,
      limit: pageSize,
    });

    return ctx.send({ data: messages.reverse() }); // reverse so oldest first
  },
}));

// ── Strip internal fields before sending over WS ─────────────────────────────
function sanitizeMessage(message) {
  return {
    id: message.id,
    content: message.content,
    message_type: message.message_type,
    is_deleted: message.is_deleted,
    createdAt: message.createdAt,
    sender: message.sender
      ? { id: message.sender.id, username: message.sender.username }
      : null,
    parent_message: message.parent_message
      ? { id: message.parent_message.id, content: message.parent_message.content }
      : null,
  };
}
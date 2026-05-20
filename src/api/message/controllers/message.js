'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::message.message', ({ strapi }) => ({

  // ── Send Message ────────────────────────────────────────────────────────────
  async create(ctx) {
    const userId = ctx.state.user.id;
    // Support both JSON and multipart/form-data (file uploads)
    const body = ctx.request.body ?? {};
    const conversationId = Number(body.conversationId);
    const content = body.content ?? '';
    const parentMessageId = body.parentMessageId ? Number(body.parentMessageId) : null;
    const files = ctx.request.files;

    if (!conversationId) return ctx.badRequest('conversationId is required');
    if (!content && !files?.['files.attachment']) return ctx.badRequest('content or attachment is required');

    const convo = await strapi.entityService.findOne('api::conversation.conversation', conversationId, {
      populate: ['participants'],
    });

    if (!convo || !convo.is_active) return ctx.notFound('Conversation not found');

    const isParticipant = convo.participants.some((p) => p.id === userId);
    const isTpChatMember = isTpChatParticipant(convo, userId);

    if (!isParticipant && !isTpChatMember) return ctx.forbidden('You are not part of this conversation');

    // Auto-add as DB participant for tp-chat
    if (!isParticipant && isTpChatMember) {
      await strapi.entityService.update('api::conversation.conversation', conversationId, {
        data: { participants: [...convo.participants.map((p) => p.id), userId] },
      });
    }

    // admins_only: only allow tutor/admin roles
    if (convo.write_access === 'admins_only') {
      const sender = await strapi.entityService.findOne('plugin::users-permissions.user', userId, {
        populate: ['role'],
      });
      const roleType = sender?.role?.type ?? '';
      if (!['tutor', 'admin', 'assistant'].includes(roleType)) {
        return ctx.forbidden('Only admins can send messages here');
      }
    }

    // Handle file attachment if present
    let attachmentIds = [];
    if (files?.['files.attachment']) {
      const uploaded = await strapi.plugins.upload.services.upload.upload({
        data: {},
        files: files['files.attachment'],
      });
      attachmentIds = uploaded.map((f) => f.id);
    }

    const message = await strapi.entityService.create('api::message.message', {
      data: {
        content: content || null,
        sender: userId,
        conversation: conversationId,
        parent_message: parentMessageId,
        message_type: attachmentIds.length ? 'attachment' : 'text',
        is_deleted: false,
        ...(attachmentIds.length && { attachment: attachmentIds }),
      },
      populate: ['sender', 'parent_message', 'attachment'],
    });

    await strapi.entityService.update('api::conversation.conversation', conversationId, {
      data: { last_message_at: new Date() },
    });

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
    const conversationId = Number(ctx.query.conversationId);
    const page = Math.max(1, Number(ctx.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(ctx.query.pageSize) || 30));

    if (!conversationId) return ctx.badRequest('conversationId is required');

    // Verify access
    const convo = await strapi.entityService.findOne('api::conversation.conversation', conversationId, {
      populate: ['participants'],
    });

    if (!convo) return ctx.notFound('Conversation not found');

    const isParticipant = convo.participants.some((p) => p.id === userId);
    const isTpChatMember = isTpChatParticipant(convo, userId);

    if (!isParticipant && convo.type !== 'subject_group' && !isTpChatMember) {
      return ctx.forbidden('Access denied');
    }

    if (!isParticipant && isTpChatMember) {
      await strapi.entityService.update('api::conversation.conversation', conversationId, {
        data: { participants: [...convo.participants.map((p) => p.id), userId] },
      });
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

// ── Check if userId is named in a tp-chat-{tpId}-{studentId} conversation ────
function isTpChatParticipant(convo, userId) {
  if (convo.type !== 'direct' || !convo.name?.startsWith('tp-chat-')) return false;
  const parts = convo.name.split('-');
  return userId === Number(parts[2]) || userId === Number(parts[3]);
}

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
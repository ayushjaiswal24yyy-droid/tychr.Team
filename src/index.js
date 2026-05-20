'use strict';

const { Server } = require('socket.io');

module.exports = {
  register() {},

  async bootstrap({ strapi }) {
    await ensurePermissions(strapi);
    initSocketIO(strapi);
  },
};

// ── Socket.io ─────────────────────────────────────────────────────────────────

function initSocketIO(strapi) {
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['https://tychr.pages.dev', 'https://platform.tychr.com', 'http://localhost:3000', 'http://localhost:3001', '*'];

  const io = new Server(strapi.server.httpServer, {
    cors: { origin: allowedOrigins, methods: ['GET', 'POST'], credentials: true },
    path: '/socket.io',
  });

  strapi.io = io;
  strapi.log.info('WebSocket server initialized');

  // ── Auth Middleware ───────────────────────────────────────────────────────
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) return next(new Error('No token provided'));

      const decoded = await strapi.plugin('users-permissions').service('jwt').verify(token);

      const user = await strapi.entityService.findOne(
        'plugin::users-permissions.user',
        decoded.id,
        { fields: ['id', 'username', 'email'] }
      );

      if (!user) return next(new Error('User not found'));

      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Authentication failed'));
    }
  });

  // ── Online status store (userId → Set of socketIds) ──────────────────────
  const onlineUsers = new Map();

  // ── Connection ────────────────────────────────────────────────────────────
  io.on('connection', async (socket) => {
    const userId = socket.user.id;
    strapi.log.info(`Client connected: ${socket.id} (user: ${userId})`);

    if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
    const wasOffline = onlineUsers.get(userId).size === 0;
    onlineUsers.get(userId).add(socket.id);

    await joinUserRooms(socket, strapi);

    if (wasOffline) {
      socket.rooms.forEach((room) => {
        if (room.startsWith('conversation:')) socket.to(room).emit('user:online', { userId });
      });
    }

    socket.on('conversation:join', async ({ conversationId }) => {
      try {
        const allowed = await canAccessConversation(userId, conversationId, strapi);
        if (!allowed) return socket.emit('error', { message: 'Access denied' });

        await addParticipantIfNeeded(userId, conversationId, strapi);
        socket.join(`conversation:${conversationId}`);
        socket.to(`conversation:${conversationId}`).emit('conversation:user_joined', {
          conversationId,
          user: { id: userId, username: socket.user.username },
        });
      } catch (err) {
        strapi.log.error(`conversation:join error — ${err.message}`);
      }
    });

    socket.on('conversation:leave', ({ conversationId }) => {
      socket.leave(`conversation:${conversationId}`);
      socket.to(`conversation:${conversationId}`).emit('conversation:user_left', {
        conversationId,
        user: { id: userId, username: socket.user.username },
      });
    });

    socket.on('typing:start', ({ conversationId }) => {
      socket.to(`conversation:${conversationId}`).emit('typing:start', {
        conversationId,
        user: { id: userId, username: socket.user.username },
      });
    });

    socket.on('typing:stop', ({ conversationId }) => {
      socket.to(`conversation:${conversationId}`).emit('typing:stop', {
        conversationId,
        user: { id: userId, username: socket.user.username },
      });
    });

    socket.on('message:read', async ({ messageIds, conversationId }) => {
      try {
        if (!Array.isArray(messageIds) || !messageIds.length) return;

        const messages = await strapi.entityService.findMany('api::message.message', {
          filters: { id: { $in: messageIds }, conversation: { id: conversationId } },
          populate: ['read_by'],
        });

        for (const msg of messages) {
          const alreadyRead = msg.read_by?.some((u) => u.id === userId);
          if (alreadyRead) continue;
          const updatedReadBy = [...(msg.read_by?.map((u) => u.id) || []), userId];
          await strapi.entityService.update('api::message.message', msg.id, {
            data: { read_by: updatedReadBy },
          });
        }

        io.to(`conversation:${conversationId}`).emit('message:read', {
          conversationId,
          messageIds,
          readBy: { id: userId, username: socket.user.username },
        });
      } catch (err) {
        strapi.log.error(`message:read error — ${err.message}`);
      }
    });

    socket.on('disconnect', () => {
      strapi.log.info(`Client disconnected: ${socket.id} (user: ${userId})`);
      const sockets = onlineUsers.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          onlineUsers.delete(userId);
          socket.rooms.forEach((room) => {
            if (room.startsWith('conversation:')) socket.to(room).emit('user:offline', { userId });
          });
        }
      }
    });

    socket.on('error', (err) => strapi.log.error(`WebSocket error: ${err.message}`));
  });

  process.on('SIGINT', () => {
    strapi.log.info('Shutting down WebSocket server...');
    io.close(() => { strapi.log.info('WebSocket server closed'); process.exit(0); });
  });
}

// ── Permissions Bootstrap ─────────────────────────────────────────────────────

const AUTHENTICATED_ACTIONS = [
  'api::ai-tutor.ai-tutor.chat',
  'api::ai-tutor.ai-tutor.generateQuestions',
  'api::ai-tutor.ai-tutor.generatePaperQuestions',
  'api::ai-tutor.ai-tutor.generateLearningPath',
  'api::message.message.find',
  'api::message.message.findOne',
  'api::message.message.create',
  'api::message.message.update',
  'api::message.message.delete',
  'api::conversation.conversation.find',
  'api::conversation.conversation.findOne',
  'api::conversation.conversation.create',
  'api::conversation.conversation.getOrCreateTpChat',
];

async function ensurePermissions(strapi) {
  const authenticatedRole = await strapi
    .query('plugin::users-permissions.role')
    .findOne({ where: { type: 'authenticated' } });

  if (!authenticatedRole) throw new Error('Authenticated role not found');

  for (const action of AUTHENTICATED_ACTIONS) {
    // Find permission scoped to this action AND this role
    const existing = await strapi
      .query('plugin::users-permissions.permission')
      .findOne({ where: { action, role: { id: authenticatedRole.id } } });

    if (!existing) {
      await strapi.query('plugin::users-permissions.permission').create({
        data: { action, role: authenticatedRole.id, enabled: true },
      });
    } else if (!existing.enabled) {
      await strapi.query('plugin::users-permissions.permission').update({
        where: { id: existing.id },
        data: { enabled: true },
      });
    }
  }

  strapi.log.info('Ensured authenticated role permissions for messaging + ai-tutor');
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function joinUserRooms(socket, strapi) {
  const userId = socket.user.id;

  socket.join(`user:${userId}`);

  const participantConvos = await strapi.entityService.findMany('api::conversation.conversation', {
    filters: { participants: { id: userId }, is_active: true },
    fields: ['id', 'type', 'name'],
  });

  // Fetch all tp-chat convos then filter in JS for exact id match
  const tpChatCandidates = await strapi.entityService.findMany('api::conversation.conversation', {
    filters: { is_active: true, type: 'direct', name: { $contains: 'tp-chat-' } },
    populate: ['participants'],
    fields: ['id', 'type', 'name'],
  });

  const tpChatForUser = tpChatCandidates.filter((c) => {
    const parts = c.name?.split('-');
    if (!parts || parts.length !== 4) return false;
    return Number(parts[2]) === userId || Number(parts[3]) === userId;
  });

  const seen = new Set();
  const allConvos = [...participantConvos, ...tpChatForUser].filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });

  for (const convo of allConvos) {
    if (convo.type === 'direct' && convo.name?.startsWith('tp-chat-')) {
      await addParticipantIfNeeded(userId, convo.id, strapi);
    }
    socket.join(`conversation:${convo.id}`);
  }

  strapi.log.info(`User ${userId} auto-joined ${allConvos.length} conversation rooms`);
}

async function canAccessConversation(userId, conversationId, strapi) {
  const convo = await strapi.entityService.findOne(
    'api::conversation.conversation',
    conversationId,
    { populate: ['participants'] }
  );

  if (!convo || !convo.is_active) return false;
  if (convo.type === 'subject_group') return true;

  if (convo.type === 'direct' && convo.name?.startsWith('tp-chat-')) {
    const parts = convo.name.split('-');
    if (parts.length === 4) {
      const tpId = Number(parts[2]);
      const sId = Number(parts[3]);
      if (userId === tpId || userId === sId) return true;
    }
  }

  return convo.participants.some((p) => p.id === userId);
}

async function addParticipantIfNeeded(userId, conversationId, strapi) {
  const convo = await strapi.entityService.findOne(
    'api::conversation.conversation',
    conversationId,
    { populate: ['participants'] }
  );

  const alreadyIn = convo.participants.some((p) => p.id === userId);
  if (alreadyIn) return;

  const isSubjectGroup = convo.type === 'subject_group';
  const isTpChat = convo.type === 'direct' && convo.name?.startsWith('tp-chat-');
  if (!isSubjectGroup && !isTpChat) return;

  await strapi.entityService.update('api::conversation.conversation', conversationId, {
    data: { participants: [...convo.participants.map((p) => p.id), userId] },
  });

  strapi.log.info(`User ${userId} auto-added to conversation ${conversationId} (${convo.name})`);
}

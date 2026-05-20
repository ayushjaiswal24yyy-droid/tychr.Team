'use strict';

const { Server } = require('socket.io');

module.exports = {
  register({ strapi }) {
    const allowedOrigins =
      process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
        : ['https://tychr.pages.dev', 'https://platform.tychr.com', 'http://localhost:3000', 'http://localhost:3001','*'];

    const io = new Server(strapi.server.httpServer, {
      cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST'],
        credentials: true,
      },
      path: '/socket.io',
    });

    strapi.io = io;
    strapi.log.info('WebSocket server initialized');

    // ── Auth Middleware ─────────────────────────────────────────────────────
    io.use(async (socket, next) => {
      try {
        const token =
          socket.handshake.auth?.token ||
          socket.handshake.headers?.authorization?.replace('Bearer ', '');

        if (!token) return next(new Error('No token provided'));

        const decoded = await strapi
          .plugin('users-permissions')
          .service('jwt')
          .verify(token);

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

    // ── Connection ──────────────────────────────────────────────────────────
    io.on('connection', async (socket) => {
      strapi.log.info(`Client connected: ${socket.id} (user: ${socket.user.id})`);

      // Join personal room + all conversation rooms
      await joinUserRooms(socket, strapi);

      // ── Join a conversation room (subject groups — lazy join) ─────────────
      socket.on('conversation:join', async ({ conversationId }) => {
        try {
          const allowed = await canAccessConversation(socket.user.id, conversationId, strapi);
          if (!allowed) return socket.emit('error', { message: 'Access denied' });

          // For subject_group: add as participant if not already
          await addParticipantIfNeeded(socket.user.id, conversationId, strapi);

          socket.join(`conversation:${conversationId}`);

          socket.to(`conversation:${conversationId}`).emit('conversation:user_joined', {
            conversationId,
            user: { id: socket.user.id, username: socket.user.username },
          });
        } catch (err) {
          strapi.log.error(`conversation:join error — ${err.message}`);
        }
      });

      // ── Leave a conversation room ─────────────────────────────────────────
      socket.on('conversation:leave', ({ conversationId }) => {
        socket.leave(`conversation:${conversationId}`);
        socket.to(`conversation:${conversationId}`).emit('conversation:user_left', {
          conversationId,
          user: { id: socket.user.id, username: socket.user.username },
        });
      });

      // ── Typing indicators ─────────────────────────────────────────────────
      socket.on('typing:start', ({ conversationId }) => {
        socket.to(`conversation:${conversationId}`).emit('typing:start', {
          conversationId,
          user: { id: socket.user.id, username: socket.user.username },
        });
      });

      socket.on('typing:stop', ({ conversationId }) => {
        socket.to(`conversation:${conversationId}`).emit('typing:stop', {
          conversationId,
          user: { id: socket.user.id, username: socket.user.username },
        });
      });

      // ── Disconnect ────────────────────────────────────────────────────────
      socket.on('disconnect', () => {
        strapi.log.info(`Client disconnected: ${socket.id} (user: ${socket.user.id})`);
      });

      socket.on('error', (err) => {
        strapi.log.error(`WebSocket error: ${err.message}`);
      });
    });

    // ── Graceful shutdown ───────────────────────────────────────────────────
    process.on('SIGINT', () => {
      strapi.log.info('Shutting down WebSocket server...');
      io.close(() => {
        strapi.log.info('WebSocket server closed');
        process.exit(0);
      });
    });
  },

  async bootstrap({ strapi }) {
    await ensureAiTutorPermissions(strapi);
  },
};

const AI_TUTOR_ACTIONS = [
  'api::ai-tutor.ai-tutor.chat',
  'api::ai-tutor.ai-tutor.generateQuestions',
  'api::ai-tutor.ai-tutor.generatePaperQuestions',
  'api::ai-tutor.ai-tutor.generateLearningPath',
];

async function ensureAiTutorPermissions(strapi) {
  const authenticatedRole = await strapi
    .query('plugin::users-permissions.role')
    .findOne({ where: { type: 'authenticated' } });

  if (!authenticatedRole) {
    throw new Error('Authenticated role not found');
  }

  for (const action of AI_TUTOR_ACTIONS) {
    const existingPermission = await strapi
      .query('plugin::users-permissions.permission')
      .findOne({ where: { action }, populate: ['role'] });

    if (!existingPermission) {
      await strapi.query('plugin::users-permissions.permission').create({
        data: {
          action,
          role: authenticatedRole.id,
        },
      });
      continue;
    }

    const existingRoleId = existingPermission.role?.id ?? existingPermission.role;

    if (existingRoleId !== authenticatedRole.id) {
      await strapi.query('plugin::users-permissions.permission').update({
        where: { id: existingPermission.id },
        data: {
          role: authenticatedRole.id,
        },
      });
    }
  }

  strapi.log.info('Ensured ai-tutor permissions are linked to the authenticated role');
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function joinUserRooms(socket, strapi) {
  // Personal room — used for conversation:created notifications
  socket.join(`user:${socket.user.id}`);

  // All active conversations user is a participant of
  const conversations = await strapi.entityService.findMany(
    'api::conversation.conversation',
    {
      filters: {
        participants: { id: socket.user.id },
        is_active: true,
      },
      fields: ['id', 'type'],
    }
  );

  for (const convo of conversations) {
    socket.join(`conversation:${convo.id}`);
  }

  strapi.log.info(
    `User ${socket.user.id} auto-joined ${conversations.length} conversation rooms`
  );
}

async function canAccessConversation(userId, conversationId, strapi) {
  const convo = await strapi.entityService.findOne(
    'api::conversation.conversation',
    conversationId,
    { populate: ['participants'] }
  );

  if (!convo || !convo.is_active) return false;

  // Subject groups are open to all authenticated users
  if (convo.type === 'subject_group') return true;

  // tp-chat direct conversations: check if user is a named participant OR if
  // the conversation was created for them (name contains their id)
  if (convo.type === 'direct' && convo.name?.startsWith('tp-chat-')) {
    const nameParts = convo.name.split('-'); // ['tp', 'chat', tpId, studentId]
    const tpId = Number(nameParts[2]);
    const studentId = Number(nameParts[3]);
    if (userId === tpId || userId === studentId) return true;
  }

  // Classroom + other direct: must already be a participant
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

  // Auto-add for subject_group (open communities) and tp-chat direct convos
  const isSubjectGroup = convo.type === 'subject_group';
  const isTpChat = convo.type === 'direct' && convo.name?.startsWith('tp-chat-');

  if (!isSubjectGroup && !isTpChat) return;

  const updatedIds = [...convo.participants.map((p) => p.id), userId];

  await strapi.entityService.update(
    'api::conversation.conversation',
    conversationId,
    { data: { participants: updatedIds } }
  );

  strapi.log.info(`User ${userId} auto-added as participant to conversation ${conversationId} (${convo.name})`);
}
'use strict';

const { Server } = require('socket.io');

module.exports = {
  register() {},

  async bootstrap({ strapi }) {
    await ensurePermissions(strapi);
    await seedTychrCountryDemoPages(strapi);
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
  'api::student-meeting.student-meeting.schedule',
  'api::student-meeting.student-meeting.myPlans',
  'api::student-meeting.student-meeting.myMeetings',
  'api::student-meeting.student-meeting.join',
  'api::student-meeting.student-meeting.complete',
  'api::student-meeting.student-meeting.interrupt',
  'api::live-lecture.live-lecture.create',
  'api::live-lecture.live-lecture.find',
  'api::live-lecture.live-lecture.findOne',
  'api::live-lecture.live-lecture.update',
];

const PUBLIC_ACTIONS = [
  'api::tychr-country.tychr-country.find',
  'api::tychr-country.tychr-country.findOne',
];

async function ensurePermissions(strapi) {
  const authenticatedRole = await strapi
    .query('plugin::users-permissions.role')
    .findOne({ where: { type: 'authenticated' } });
  const publicRole = await strapi
    .query('plugin::users-permissions.role')
    .findOne({ where: { type: 'public' } });

  if (!authenticatedRole) throw new Error('Authenticated role not found');
  if (!publicRole) throw new Error('Public role not found');

  await enableRoleActions(strapi, authenticatedRole, AUTHENTICATED_ACTIONS);
  await enableRoleActions(strapi, publicRole, PUBLIC_ACTIONS);

  strapi.log.info('Ensured role permissions for messaging, ai-tutor, and tychr-country demo content');
}

async function enableRoleActions(strapi, role, actions) {
  for (const action of actions) {
    const existing = await strapi
      .query('plugin::users-permissions.permission')
      .findOne({ where: { action, role: { id: role.id } } });

    if (!existing) {
      await strapi.query('plugin::users-permissions.permission').create({
        data: { action, role: role.id, enabled: true },
      });
    } else if (!existing.enabled) {
      await strapi.query('plugin::users-permissions.permission').update({
        where: { id: existing.id },
        data: { enabled: true },
      });
    }
  }
}

const TYCHR_COUNTRY_DEMO_PAGES = [
  {
    countrySlug: 'uk',
    slug: 'home',
    pageCategory: 'home',
    title: 'TYCHR UK',
    heroTitle: 'TYCHR UK',
    heroSubtitle: 'Demo homepage content for TYCHR UK.',
  },
  {
    countrySlug: 'uk',
    slug: 'ibdp',
    pageCategory: 'programme',
    title: 'IBDP Tutors in the UK',
    heroTitle: 'IBDP support for UK students',
    heroSubtitle: 'CMS-driven demo page for the UK IBDP route.',
  },
  {
    countrySlug: 'uk',
    slug: 'myp',
    pageCategory: 'programme',
    title: 'MYP Tutors in the UK',
    heroTitle: 'MYP support for UK students',
    heroSubtitle: 'CMS-driven demo page for the UK MYP route.',
  },
  {
    countrySlug: 'dubai',
    slug: 'home',
    pageCategory: 'home',
    title: 'TYCHR Dubai',
    heroTitle: 'TYCHR Dubai',
    heroSubtitle: 'Demo homepage content for TYCHR Dubai.',
  },
  {
    countrySlug: 'dubai',
    slug: 'ibdp',
    pageCategory: 'programme',
    title: 'IBDP Tutors in Dubai',
    heroTitle: 'IBDP support for Dubai students',
    heroSubtitle: 'CMS-driven demo page for the Dubai IBDP route.',
  },
  {
    countrySlug: 'dubai',
    slug: 'myp',
    pageCategory: 'programme',
    title: 'MYP Tutors in Dubai',
    heroTitle: 'MYP support for Dubai students',
    heroSubtitle: 'CMS-driven demo page for the Dubai MYP route.',
  },
  {
    countrySlug: 'dubai',
    slug: 'ib-maths',
    pageCategory: 'subject',
    title: 'IB Maths Tutors in Dubai',
    heroTitle: 'IB Maths support for Dubai students',
    heroSubtitle: 'CMS-driven demo page for the Dubai IB Maths route.',
  },
  {
    countrySlug: 'singapore',
    slug: 'home',
    pageCategory: 'home',
    title: 'TYCHR Singapore',
    heroTitle: 'TYCHR Singapore',
    heroSubtitle: 'Demo homepage content for TYCHR Singapore.',
  },
  {
    countrySlug: 'singapore',
    slug: 'ibdp',
    pageCategory: 'programme',
    title: 'IBDP Tutors in Singapore',
    heroTitle: 'IBDP support for Singapore students',
    heroSubtitle: 'CMS-driven demo page for the Singapore IBDP route.',
  },
  {
    countrySlug: 'singapore',
    slug: 'myp',
    pageCategory: 'programme',
    title: 'MYP Tutors in Singapore',
    heroTitle: 'MYP support for Singapore students',
    heroSubtitle: 'CMS-driven demo page for the Singapore MYP route.',
  },
];

async function seedTychrCountryDemoPages(strapi) {
  const uid = 'api::tychr-country.tychr-country';

  for (const page of TYCHR_COUNTRY_DEMO_PAGES) {
    const data = {
      ...page,
      seoTitle: page.title,
      seoDescription: page.heroSubtitle,
      content: `# ${page.heroTitle}\n\n${page.heroSubtitle}\n\nThis proof-of-concept entry is served from one Strapi collection using countrySlug + slug.`,
      publishedAt: new Date(),
    };

    const existing = await strapi.db.query(uid).findOne({
      where: {
        countrySlug: page.countrySlug,
        slug: page.slug,
      },
    });

    if (existing) {
      await strapi.entityService.update(uid, existing.id, { data });
    } else {
      await strapi.entityService.create(uid, { data });
    }
  }

  strapi.log.info('Seeded TYCHR country demo pages');
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

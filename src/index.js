'use strict';

const { Server } = require('socket.io');

module.exports = {
  register() {},

  async bootstrap({ strapi }) {
    await ensurePermissions(strapi);
    await seedTychrCountryPages(strapi);
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
  'api::test-serie.pdf.exportResultsBatch',
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

  strapi.log.info('Ensured role permissions for messaging, ai-tutor, and tychr-country content');
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

const INITIAL_TYCHR_COUNTRIES = [
  { slug: 'uk', name: 'UK' },
  { slug: 'dubai', name: 'Dubai' },
  { slug: 'singapore', name: 'Singapore' },
  { slug: 'hongkong', name: 'Hong Kong' },
  { slug: 'canada', name: 'Canada' },
];

const TYCHR_COUNTRY_PAGE_TYPES = [
  { slug: 'home', label: 'TYCHR', category: 'home' },
  { slug: 'ibdp', label: 'IBDP', category: 'programme' },
  { slug: 'myp', label: 'MYP', category: 'programme' },
  { slug: 'ib-maths', label: 'IB Maths', category: 'subject' },
  { slug: 'ib-physics', label: 'IB Physics', category: 'subject' },
  { slug: 'ib-chemistry', label: 'IB Chemistry', category: 'subject' },
  { slug: 'ib-biology', label: 'IB Biology', category: 'subject' },
  { slug: 'ib-english', label: 'IB English', category: 'subject' },
  { slug: 'ib-economics', label: 'IB Economics', category: 'subject' },
  { slug: 'ia', label: 'IB Internal Assessment', category: 'coursework' },
  { slug: 'ee', label: 'Extended Essay', category: 'coursework' },
  { slug: 'tok', label: 'Theory of Knowledge', category: 'coursework' },
  { slug: 'igcse', label: 'IGCSE', category: 'programme' },
  { slug: 'sat', label: 'SAT', category: 'test-prep' },
  { slug: 'act', label: 'ACT', category: 'test-prep' },
];

async function seedTychrCountryPages(strapi) {
  const uid = 'api::tychr-country.tychr-country';

  for (const country of INITIAL_TYCHR_COUNTRIES) {
    for (const pageType of TYCHR_COUNTRY_PAGE_TYPES) {
      const data = buildTychrCountryPage(country, pageType);
      const existing = await strapi.db.query(uid).findOne({
        where: {
          countrySlug: data.countrySlug,
          slug: data.slug,
        },
      });

      if (!existing) {
        await strapi.entityService.create(uid, { data });
      } else if (isPreviousDemoTychrCountryPage(existing)) {
        await strapi.entityService.update(uid, existing.id, { data });
      }
    }
  }

  strapi.log.info('Seeded TYCHR country pages');
}

function buildTychrCountryPage(country, pageType) {
  if (pageType.slug === 'home') {
    const title = `TYCHR ${country.name}`;
    const heroSubtitle = `Personalised academic support for students in ${country.name}.`;

    return {
      title,
      countrySlug: country.slug,
      slug: pageType.slug,
      pageCategory: pageType.category,
      heroTitle: title,
      heroSubtitle,
      seoTitle: title,
      seoDescription: heroSubtitle,
      content: `# ${title}\n\n${heroSubtitle}\n\nThis page is powered by the tychr-country collection using countrySlug + slug.`,
      publishedAt: new Date(),
    };
  }

  const title = `${pageType.label} Tutors in ${country.name}`;
  const heroTitle = `${pageType.label} support for students in ${country.name}`;
  const heroSubtitle = `Expert ${pageType.label} tutoring and guidance for students in ${country.name}.`;

  return {
    title,
    countrySlug: country.slug,
    slug: pageType.slug,
    pageCategory: pageType.category,
    heroTitle,
    heroSubtitle,
    seoTitle: title,
    seoDescription: heroSubtitle,
    content: `# ${heroTitle}\n\n${heroSubtitle}\n\nThis page is powered by the tychr-country collection using countrySlug + slug.`,
    publishedAt: new Date(),
  };
}

function isPreviousDemoTychrCountryPage(entry) {
  const fields = [
    entry.heroSubtitle,
    entry.seoDescription,
    entry.content,
  ].filter(Boolean);

  return fields.some((value) => /demo|proof-of-concept/i.test(value));
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

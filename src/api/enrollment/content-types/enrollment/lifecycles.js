'use strict';
const strapiWithIO = /** @type {any} */ (strapi);
module.exports = {
  // ─── Classroom Approved → Create Conversation with just the tutor ───────────
  async afterUpdate(event) {
    const { result } = event;

    const enrollment = await strapi.entityService.findOne('api::enrollment.enrollment', result.id, {
      populate: ['tutor', 'students'],
    });

    if (!enrollment) return;

    // ── Handle status → Approved ──────────────────────────────────────────────
    if (result.status === 'Approved') {
      const existing = await strapi.entityService.findMany('api::conversation.conversation', {
        filters: { classroom: { id: enrollment.id } },
        limit: 1,
      });

      if (existing.length === 0) {
        const tutorId = enrollment.tutor?.id;

        const conversation = await strapi.entityService.create('api::conversation.conversation', {
          data: {
            type: 'classroom',
            name: enrollment.classroom_name || `Classroom #${enrollment.id}`,
            classroom: enrollment.id,
            participants: tutorId ? [tutorId] : [],
            is_active: true,
            write_access: 'all',
            last_message_at: new Date(),
          },
        });

        strapi.log.info(`Conversation created for classroom ${enrollment.id}`);

        // Notify tutor in real-time
        if (strapiWithIO.io && tutorId) {
          strapiWithIO.io.to(`user:${tutorId}`).emit('conversation:created', {
            conversation: {
              id: conversation.id,
              type: 'classroom',
              name: enrollment.classroom_name || `Classroom #${enrollment.id}`,
            },
          });
        }
      }
    }

    // ── Handle students relation change (add/remove) ──────────────────────────
    // Always run this block on any enrollment update so student joins/leaves
    // are reflected in the conversation regardless of what else changed

    const conversation = await strapi.entityService.findMany('api::conversation.conversation', {
      filters: { classroom: { id: enrollment.id } },
      populate: ['participants'],
      limit: 1,
    });

    // No conversation exists yet (classroom not approved), nothing to sync
    if (conversation.length === 0) return;

    const convo = conversation[0];

    const currentStudentIds = (enrollment.students || []).map((s) => s.id);
    const currentParticipantIds = (convo.participants || []).map((p) => p.id);
    const tutorId = enrollment.tutor?.id;

    // Build expected participant list: tutor + current students
    const expectedIds = [...new Set([tutorId, ...currentStudentIds].filter(Boolean))];

    // Find who needs to be added
    const toAdd = expectedIds.filter((id) => !currentParticipantIds.includes(id));

    // Find who needs to be removed (exclude tutor — never remove tutor)
    const toRemove = currentParticipantIds.filter(
      (id) => id !== tutorId && !currentStudentIds.includes(id)
    );

    // No changes needed
    if (toAdd.length === 0 && toRemove.length === 0) return;

    const updatedParticipants = [
      ...currentParticipantIds.filter((id) => !toRemove.includes(id)),
      ...toAdd,
    ];

    await strapi.entityService.update('api::conversation.conversation', convo.id, {
      data: {
        participants: updatedParticipants,
        last_message_at: new Date(),
      },
    });

    // Emit system messages for joins/leaves so chat shows activity
    const systemMessages = [];

    for (const id of toAdd) {
      if (id === tutorId) continue; // skip tutor join message
      systemMessages.push(
        strapi.entityService.create('api::message.message', {
          data: {
            conversation: convo.id,
            message_type: 'system',
            content: `A new student joined the classroom.`,
            is_deleted: false,
          },
        })
      );
    }

    for (const id of toRemove) {
      systemMessages.push(
        strapi.entityService.create('api::message.message', {
          data: {
            conversation: convo.id,
            message_type: 'system',
            content: `A student left the classroom.`,
            is_deleted: false,
          },
        })
      );
    }

    await Promise.all(systemMessages);

    if (toAdd.length > 0) strapi.log.info(`Added participants ${toAdd} to conversation ${convo.id}`);
    if (toRemove.length > 0) strapi.log.info(`Removed participants ${toRemove} from conversation ${convo.id}`);
for (const id of toAdd) {
  if (id === tutorId) continue;

  // Notify the student they've been added to a classroom conversation
  if (strapiWithIO.io) {
    strapiWithIO.io.to(`user:${id}`).emit('conversation:created', {
      conversation: {
        id: convo.id,
        type: 'classroom',
        name: enrollment.classroom_name || `Classroom #${enrollment.id}`,
      },
    });
  }
}
  },
};
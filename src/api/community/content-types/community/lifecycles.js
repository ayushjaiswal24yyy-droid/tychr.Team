'use strict';

module.exports = {
  async afterCreate(event) {
    const { result } = event;

    // Only for subject group communities (not classroom-linked ones)
    // Classroom communities already get their conversation via enrollment hook
    if (result.classroom) return;

    // Create linked conversation
    const conversation = await strapi.entityService.create('api::conversation.conversation', {
      data: {
        type: 'subject_group',
        name: result.Name,
        image: result.image || null,
        is_active: true,
        write_access: 'all',
        last_message_at: new Date(),
        // No participants yet — users join when they first open the community
      },
    });

    // Link conversation back to community
    await strapi.entityService.update('api::community.community', result.id, {
      data: {
        conversation: conversation.id,
      },
    });
  },
};
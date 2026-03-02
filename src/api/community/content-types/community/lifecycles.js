module.exports = {
  async afterCreate(event) {
    const { result } = event;

    console.log('Community afterCreate fired:', result.id, 'classroom:', result.classroom);

    if (result.classroom) return;

    try {
      const conversation = await strapi.entityService.create('api::conversation.conversation', {
        data: {
          type: 'subject_group',
          name: result.Name,
          is_active: true,
          write_access: 'all',
          last_message_at: new Date(),
        },
      });

      console.log('Conversation created:', conversation.id);

      await strapi.entityService.update('api::community.community', result.id, {
        data: { conversation: conversation.id },
      });

      console.log('Community updated with conversation');
    } catch (err) {
      console.error('Failed to create conversation for community:', err.message);
    }
  },

  // ADD THIS — Strapi admin UI publishes after create
  // so afterCreate fires on draft, afterUpdate fires on publish
  async afterUpdate(event) {
    const { result } = event;

    console.log('Community afterUpdate fired:', result.id, 'conversation:', result.conversation);

    // Skip if already has a conversation
    if (result.conversation) return;

    // Skip if linked to a classroom
    if (result.classroom) return;

    try {
      const conversation = await strapi.entityService.create('api::conversation.conversation', {
        data: {
          type: 'subject_group',
          name: result.Name,
          is_active: true,
          write_access: 'all',
          last_message_at: new Date(),
        },
      });

      await strapi.entityService.update('api::community.community', result.id, {
        data: { conversation: conversation.id },
      });

      console.log(`Conversation ${conversation.id} linked to community ${result.id} via afterUpdate`);
    } catch (err) {
      console.error('Community afterUpdate conversation error:', err.message);
    }
  },
};
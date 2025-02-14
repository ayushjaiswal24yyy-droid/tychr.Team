'use strict';

/**
 * post controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::post.post', ({ strapi }) => ({
  async create(ctx) {

    const response = await super.create(ctx);

    if (strapi.io) {
      const newPost = response.data; // Extract the newly created post
      strapi.io.emit('newPost', newPost); // Broadcast the new post
    }

    return response;
  },
}));
"use strict";
/**
 * post controller
 */
const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController("api::post.post", ({ strapi }) => ({
  async create(ctx) {
    const response = await super.create(ctx);

    const populatedPost = await strapi.entityService.findOne(
      "api::post.post",
      response.data.id,
      {
        populate: ["author", "attachment", "community"],
      }
    );

    if (strapi.io) {
      strapi.io.emit("newPost", populatedPost); // Broadcast the fully populated post
      console.log("New post broadcasted:", populatedPost);
    }

    return response;
  },
}));

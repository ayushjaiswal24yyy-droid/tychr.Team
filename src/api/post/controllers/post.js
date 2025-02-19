"use strict";
const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController("api::post.post", ({ strapi }) => ({
  async create(ctx) {
    const response = await super.create(ctx);

    const populatedPost = await strapi.entityService.findOne(
      "api::post.post",
      response.data.id,
      {
        populate: ["author", "attachment", "community"], // Add all relational fields here
      }
    );

    const formattedPost = {
      id: populatedPost.id,
      attributes: {
        ...populatedPost,
      },
    };

    if (strapi.io) {
      strapi.io.emit("newPost", formattedPost);
      console.log("New post broadcasted:", formattedPost);
    }

    return response;
  },
}));

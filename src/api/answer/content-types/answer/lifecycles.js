"use strict";

module.exports = {
  async beforeCreate(event) {
    // Answers must be published immediately so admin queries (which default
    // to publicationState:"live") can find them without needing "preview" mode.
    if (!event.params.data.publishedAt) {
      event.params.data.publishedAt = new Date();
    }
  },

  async afterCreate(event) {
    const { result } = event;

    // Don't await — let it run in background so student gets instant response
    strapi
      .service("api::answer.answer")
      .processBulkEvaluation([result.id])
      .catch((err) =>
        strapi.log.error(`Background evaluation failed for answer ${result.id}:`, err)
      );
  },
};
"use strict";

module.exports = {
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
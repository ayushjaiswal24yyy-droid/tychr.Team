"use strict"

const { createCoreController } = require("@strapi/strapi").factories;


module.exports = createCoreController("api::answer.answer", () => ({
  async bulkEvaluate(ctx) {
    try {
      const { answerIds } = ctx.request.body;

      if (!answerIds || !Array.isArray(answerIds) || answerIds.length === 0) {
        return ctx.badRequest('A valid array of answerIds is required.');
      }

      // Mark as 'in_progress' immediately if doing this asynchronously, 
      // but here is the synchronous await for the service:
      const results = await strapi.service('api::answer.answer').processBulkEvaluation(answerIds);

      return ctx.send({
        success: true,
        message: `Successfully evaluated ${results.evaluatedCount} submissions`,
        data: results,
      });
    } catch (err) {
      ctx.throw(500, err.message);
    }
  },
}));
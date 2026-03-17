"use strict"

const { createCoreController } = require("@strapi/strapi").factories;


module.exports = createCoreController("api::answer.answer", () => ({
  async bulkEvaluate(ctx) {
    try {
      const { answerIds } = ctx.request.body;

      if (!answerIds || !Array.isArray(answerIds) || answerIds.length === 0) {
        return ctx.badRequest('A valid array of answerIds is required.');
      }

      const results = await strapi.service('api::answer.answer').processBulkEvaluation(answerIds);

      return ctx.send({
        success: true,
        message: `Successfully evaluated ${results.evaluatedCount} submissions`,
        data: results,
      });
    } catch (err) {
      // Log the deep validation details to your Strapi terminal
      console.error("Bulk Eval Error Details:", JSON.stringify(err.details, null, 2));
      
      // Pass the message back to the frontend
      ctx.throw(500, err.message);
    }
  },
}));
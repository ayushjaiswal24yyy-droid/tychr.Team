const os = require("os");
const fs = require("fs");
const path = require("path");

module.exports = {
  async generate(ctx) {
    try {
      const { id } = ctx.params;

      const paper = await strapi.entityService.findOne(
        "api::test-serie.test-serie",
        id,
        {
          populate: {
            question_banks: {
              populate: ["parts", "attachments"],
            },
          },
        }
      );

      if (!paper) return ctx.notFound("Test paper not found");
      if (paper.test_mode !== "offline") {
        return ctx.badRequest("PDF generation is only allowed for offline papers");
      }

      const lambdaUrl = process.env.PDF_LAMBDA_URL;
      const secret = process.env.PDF_SECRET;
      const strapiUrl = process.env.STRAPI_URL || "http://localhost:1337";
      const strapiToken = process.env.STRAPI_API_TOKEN;

      if (!lambdaUrl || !secret || !strapiToken) {
        return ctx.internalServerError("PDF service is not configured");
      }

      const response = await fetch(lambdaUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-pdf-secret": secret,
        },
        body: JSON.stringify({
          paper,
          paperId: id,
          strapiUrl,
          strapiToken,
        }),
        signal: AbortSignal.timeout(55000),
      });

      const result = await response.json();

      if (!response.ok) {
        return ctx.internalServerError(result?.error || "PDF generation failed");
      }

      return ctx.send(result);
    } catch (err) {
      strapi.log.error("PDF controller error:", err);
      return ctx.internalServerError(`PDF generation failed: ${err.message}`);
    }
  },
};
// src/api/test-serie/controllers/pdf.js
//
// This controller no longer runs Puppeteer itself.
// It fetches the paper from Strapi, then calls the Lambda PDF service
// and pipes the response back to the client.

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

      if (!lambdaUrl || !secret) {
        strapi.log.error("PDF_LAMBDA_URL or PDF_SECRET env vars are not set");
        return ctx.internalServerError("PDF service is not configured");
      }

      // Call the Lambda function with the full paper payload
      const response = await fetch(lambdaUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-pdf-secret": secret,
        },
        body: JSON.stringify(paper),
        // 55s — just under Lambda's 60s timeout, gives room for network overhead
        signal: AbortSignal.timeout(55000),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({ error: "Unknown error" }));
        strapi.log.error("Lambda PDF service error:", errBody);
        return ctx.internalServerError(
          errBody?.error || "PDF generation failed"
        );
      }

      const pdfBuffer = Buffer.from(await response.arrayBuffer());
      const filename = `${(paper.title || "test-paper").replace(/[^a-z0-9]/gi, "_")}.pdf`;

      ctx.set("Content-Type", "application/pdf");
      ctx.set("Content-Disposition", `attachment; filename="${filename}"`);
      ctx.body = pdfBuffer;
    } catch (err) {
      strapi.log.error("PDF controller error:", err);
      return ctx.internalServerError(`PDF generation failed: ${err.message}`);
    }
  },
};
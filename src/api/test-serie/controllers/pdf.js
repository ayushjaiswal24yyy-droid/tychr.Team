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
        return ctx.internalServerError("PDF service is not configured");
      }

      const response = await fetch(lambdaUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-pdf-secret": secret,
        },
        body: JSON.stringify(paper),
        signal: AbortSignal.timeout(55000),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({ error: "Unknown error" }));
        return ctx.internalServerError(errBody?.error || "PDF generation failed");
      }

      // Lambda returns { body: base64string, isBase64Encoded: true, ... }
      const lambdaResult = await response.json();
      const pdfBuffer = Buffer.from(lambdaResult.body, "base64");
      const filename = `${(paper.title || "paper").replace(/[^a-z0-9]/gi, "_")}.pdf`;

      // Upload to Strapi media library
      const uploadedFiles = await strapi.plugins.upload.services.upload.upload({
        data: {},
        files: {
          path: null,
          name: filename,
          type: "application/pdf",
          size: pdfBuffer.length,
          buffer: pdfBuffer,
        },
      });

      const uploadedFile = uploadedFiles[0];

      // Save to offline_pdf field on the paper
      await strapi.entityService.update(
        "api::test-serie.test-serie",
        id,
        { data: { offline_pdf: uploadedFile.id } }
      );

      return ctx.send({
        success: true,
        file: {
          id: uploadedFile.id,
          url: uploadedFile.url,
          name: uploadedFile.name,
        },
      });

    } catch (err) {
      strapi.log.error("PDF controller error:", err);
      return ctx.internalServerError(`PDF generation failed: ${err.message}`);
    }
  },
};
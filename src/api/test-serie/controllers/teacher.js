"use strict";

const { createCoreController } = require("@strapi/strapi").factories;




module.exports = createCoreController(
  "api::test-serie.test-serie",
  ({ strapi }) => ({
    async approveResume(ctx) {
  try {
    const { attemptId } = ctx.params;
    const teacher = ctx.state.user;

    if (!teacher || !attemptId) {
      return ctx.badRequest("Invalid request");
    }

    // 1️⃣ Fetch attempt marker
    const marker = await strapi.entityService.findOne(
      "api::answer.answer",
      attemptId,
      {
        fields: [
          "id",
          "resume_status",
          "completed",
          "auto_submitted",
          "phase",
        ],
      }
    );

    if (!marker) {
      return ctx.notFound("Attempt not found");
    }

    // 2️⃣ Validate state
    if (marker.resume_status !== "requested") {
      return ctx.badRequest("No pending resume request");
    }

    // 3️⃣ Update marker (reopen attempt)
    await strapi.entityService.update(
      "api::answer.answer",
      attemptId,
      {
        data: {
          resume_status: "approved",
          resume_approved_at: new Date(),
          completed: false,
          auto_submitted: false,
          phase: "answering",
          phase_started_at: new Date(), // resume from now
        },
      }
    );

    return {
      data: {
        success: true,
        resume_status: "approved",
        message: "Resume approved. Student may continue the test.",
      },
    };
  } catch (error) {
    console.error("Error in approveResume:", error);
    ctx.throw(500, error.message);
  }
},async rejectResume(ctx) {
  try {
    const { attemptId } = ctx.params;
    const teacher = ctx.state.user;

    if (!teacher || !attemptId) {
      return ctx.badRequest("Invalid request");
    }

    // 1️⃣ Fetch attempt marker
    const marker = await strapi.entityService.findOne(
      "api::answer.answer",
      attemptId,
      {
        fields: ["id", "resume_status"],
      }
    );

    if (!marker) {
      return ctx.notFound("Attempt not found");
    }

    // 2️⃣ Validate state
    if (marker.resume_status !== "requested") {
      return ctx.badRequest("No pending resume request");
    }

    // 3️⃣ Reject request
    await strapi.entityService.update(
      "api::answer.answer",
      attemptId,
      {
        data: {
          resume_status: "rejected",
        },
      }
    );

    return {
      data: {
        success: true,
        resume_status: "rejected",
        message: "Resume request rejected.",
      },
    };
  } catch (error) {
    console.error("Error in rejectResume:", error);
    ctx.throw(500, error.message);
  }
}


  }));
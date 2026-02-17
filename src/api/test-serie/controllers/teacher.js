"use strict";
const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::test-serie.test-serie",
  ({ strapi }) => ({
    
    // ✅ Get all pending resume requests
    async getResumeRequests(ctx) {
      try {
        const teacher = ctx.state.user;
        
        if (!teacher) {
          return ctx.unauthorized("User not authenticated");
        }

        // Fetch all resume requests with status "requested"
        const resumeRequests = await strapi.entityService.findMany(
          "api::answer.answer",
          {
            filters: {
              is_attempt_marker: true,
              resume_status: "requested",
              auto_submitted: true,
            },
            populate: {
              student: {
                fields: ["id", "fullName", "email"], // ✅ Fixed: removed firstName, lastName
              },
              test_series: {
                fields: ["id", "title"],
              },
            },
            fields: [
              "id",
              "attempt_id",
              "resume_status",
              "resume_requested_at",
              "resume_reason",
              "violation_count",
              "started_at",
            ],
            sort: { resume_requested_at: "desc" },
          }
        );

        // Format the response
        const formatted = resumeRequests.map((req) => ({
          id: req.id,
          attempt_id: req.attempt_id,
          student: {
            id: req.student?.id,
            name: req.student?.fullName || "Unknown Student", // ✅ Fixed: use fullName only
            email: req.student?.email,
          },
          series: {
            id: req.test_series?.id,
            title: req.test_series?.title || "Unknown Series",
          },
          resume_reason: req.resume_reason || null,
          violation_count: req.violation_count || 0,
          requested_at: req.resume_requested_at,
          started_at: req.started_at,
        }));

        return {
          data: formatted,
          meta: {
            total: formatted.length,
          },
        };
      } catch (error) {
        console.error("Error in getResumeRequests:", error);
        ctx.throw(500, error.message);
      }
    },

    // ✅ Get resume request history (approved/rejected)
    async getResumeRequestHistory(ctx) {
      try {
        const teacher = ctx.state.user;
        
        if (!teacher) {
          return ctx.unauthorized("User not authenticated");
        }

        const { status } = ctx.query; // Optional filter by status

        const filters = {
          is_attempt_marker: true,
          auto_submitted: true,
          resume_status: status 
            ? status 
            : { $in: ["approved", "rejected"] },
        };

        const resumeRequests = await strapi.entityService.findMany(
          "api::answer.answer",
          {
            filters,
            populate: {
              student: {
                fields: ["id", "fullName", "email"], // ✅ Fixed: removed firstName, lastName
              },
              test_series: {
                fields: ["id", "title"],
              },
            },
            fields: [
              "id",
              "attempt_id",
              "resume_status",
              "resume_requested_at",
              "resume_approved_at",
              "resume_reason",
              "violation_count",
              "started_at",
            ],
            sort: { resume_requested_at: "desc" },
            limit: 50, // Limit history to recent 50
          }
        );

        const formatted = resumeRequests.map((req) => ({
          id: req.id,
          attempt_id: req.attempt_id,
          student: {
            id: req.student?.id,
            name: req.student?.fullName || "Unknown Student", // ✅ Fixed: use fullName only
            email: req.student?.email,
          },
          series: {
            id: req.test_series?.id,
            title: req.test_series?.title || "Unknown Series",
          },
          resume_reason: req.resume_reason || null,
          violation_count: req.violation_count || 0,
          resume_status: req.resume_status,
          requested_at: req.resume_requested_at,
          approved_at: req.resume_approved_at,
          started_at: req.started_at,
        }));

        return {
          data: formatted,
          meta: {
            total: formatted.length,
          },
        };
      } catch (error) {
        console.error("Error in getResumeRequestHistory:", error);
        ctx.throw(500, error.message);
      }
    },

    // ✅ Approve resume request
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
    },

    // ✅ Reject resume request
    async rejectResume(ctx) {
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
    },
  })
);
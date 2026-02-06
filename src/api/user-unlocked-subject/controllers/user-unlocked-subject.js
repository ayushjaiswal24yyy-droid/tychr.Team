"use strict";

/**
 * user-unlocked-subject controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::user-unlocked-subject.user-unlocked-subject",
  ({ strapi }) => ({

    /**
     * POST /user-unlocked-subjects/unlock
     * Body: { grade_subject_id, user_content_plan_id }
     */
    async unlock(ctx) {
      const user = ctx.state.user;
      if (!user) {
        return ctx.unauthorized("Unauthorized");
      }

      const { grade_subject_id, user_content_plan_id } = ctx.request.body;

      if (!grade_subject_id || !user_content_plan_id) {
        return ctx.badRequest(
          "grade_subject_id and user_content_plan_id are required"
        );
      }

      /**
       * 1️⃣ Fetch the user content plan
       */
      const userContentPlan = await strapi.entityService.findOne(
        "api::user-content-plan.user-content-plan",
        user_content_plan_id,
        {
          populate: ["student"],
        }
      );

      if (!userContentPlan) {
        return ctx.badRequest("User content plan not found");
      }

      // Ownership check
      if (userContentPlan.student.id !== user.id) {
        return ctx.forbidden("This plan does not belong to you");
      }

      // Status check
      if (userContentPlan.status !== "active") {
        return ctx.badRequest("This plan is not active");
      }

      // Expiry check
      if (
        userContentPlan.expires_at &&
        new Date(userContentPlan.expires_at) < new Date()
      ) {
        return ctx.badRequest("This plan has expired");
      }

      // Slot check
      if (userContentPlan.remaining_subjects <= 0) {
        return ctx.badRequest("No remaining subjects available in this plan");
      }

      /**
       * 2️⃣ Prevent double unlock
       */
      const existingUnlock = await strapi.db
        .query("api::user-unlocked-subject.user-unlocked-subject")
        .findOne({
          where: {
            student: user.id,
            grade_subject: grade_subject_id,
            status: "active",
          },
        });

      if (existingUnlock) {
        return ctx.badRequest("Subject already unlocked");
      }

      /**
       * 3️⃣ Create unlock record
       */
      const now = new Date();

      const unlockedSubject = await strapi.entityService.create(
        "api::user-unlocked-subject.user-unlocked-subject",
        {
          data: {
            student: user.id,
            user_content_plan: userContentPlan.id,
            grade_subject: grade_subject_id,
            unlocked_at: now,
            expires_at: userContentPlan.expires_at,
            status: "active",
          },
        }
      );

      /**
       * 4️⃣ Decrement remaining subjects
       */
      await strapi.entityService.update(
        "api::user-content-plan.user-content-plan",
        userContentPlan.id,
        {
          data: {
            remaining_subjects:
              userContentPlan.remaining_subjects - 1,
          },
        }
      );

      return {
        success: true,
        message: "Subject unlocked successfully",
        data: {
          unlocked_subject_id: unlockedSubject.id,
          remaining_subjects:
            userContentPlan.remaining_subjects - 1,
        },
      };
    },
  })
);

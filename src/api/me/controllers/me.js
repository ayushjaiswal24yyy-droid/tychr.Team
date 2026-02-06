"use strict";

module.exports = {
  async contentPlan(ctx) {
    const user = ctx.state.user;

    if (!user) {
      return ctx.unauthorized();
    }

    // 1️⃣ Find active plan (allow expires_at = null)
    const activePlan = await strapi.db
      .query("api::user-content-plan.user-content-plan")
      .findOne({
        where: {
          student: user.id,
          status: "active",
          $or: [
            { expires_at: { $gt: new Date() } },
            { expires_at: null },
          ],
        },
        orderBy: { purchased_at: "desc" },
        populate: ["content_plan"],
      });

    if (!activePlan || !activePlan.content_plan) {
      return {
        plan: null,
        unlocked_subject_ids: [],
      };
    }

    // 2️⃣ Fetch unlocked subjects
    const unlockedSubjects = await strapi.db
      .query("api::user-unlocked-subject.user-unlocked-subject")
      .findMany({
        where: {
          student: user.id,
          status: "active",
        },
        select: ["grade_subject"],
      });

    return {
      plan: {
        id: activePlan.id,
        remaining_subjects: activePlan.remaining_subjects,
        expires_at: activePlan.expires_at,
        content_plan: {
          id: activePlan.content_plan.id,
          title: activePlan.content_plan.title,
          subject_limit: activePlan.content_plan.subject_limit,
          duration_months: activePlan.content_plan.duration_months,
        },
      },
      unlocked_subject_ids: unlockedSubjects.map(
        (u) => u.grade_subject
      ),
    };
  },
};

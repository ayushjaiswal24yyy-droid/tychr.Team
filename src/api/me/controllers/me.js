"use strict";

module.exports = {
    async contentPlan(ctx) {
        const user = ctx.state.user;
        if (!user) return ctx.unauthorized();

        // 1️⃣ Fetch latest ACTIVE plan (no date logic in SQL)
        const plans = await strapi.db
            .query("api::user-content-plan.user-content-plan")
            .findMany({
                where: {
                    student: { id: user.id },
                    status: "active",
                },
                orderBy: { purchased_at: "desc" },
                limit: 1,
                populate: ["content_plan"],
            });

        const activePlan = plans[0];

        if (!activePlan || !activePlan.content_plan) {
            return {
                plan: null,
                unlocked_subject_ids: [],
            };
        }

        // 2️⃣ Expiry check in JS (safe & predictable)
        if (
            activePlan.expires_at &&
            new Date(activePlan.expires_at) < new Date()
        ) {
            return {
                plan: null,
                unlocked_subject_ids: [],
            };
        }

        // 3️⃣ Fetch unlocked subjects
        const unlockedSubjects = await strapi.db
            .query("api::user-unlocked-subject.user-unlocked-subject")
            .findMany({
                where: {
                    student: { id: user.id },
                    status: "active",
                },
                populate: ["grade_subject"],
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
                (u) => u.grade_subject.id
            ),
        };
    },
    async subtopicNotes(ctx) {
        const user = ctx.state.user;
        const subtopicId = Number(ctx.params.id);

        if (!user) return ctx.unauthorized();

        const subtopic = await strapi.entityService.findOne(
            "api::subtopic.subtopic",
            subtopicId,
            {
                populate: {
                    topic: {
                        populate: {
                            grade_subject: true,
                        },
                    },
                    notes: {
                        populate: ["note"],
                    },
                },
            }
        );

        if (!subtopic) {
            return ctx.notFound("Subtopic not found");
        }

        const gradeSubjectId =
            subtopic.topic?.grade_subject?.id;

        if (!gradeSubjectId) {
            return ctx.badRequest("Invalid subtopic mapping");
        }

        const topic = subtopic.topic;

        const isFree =
            topic.order === 0 && subtopic.order === 0;

        if (isFree) {
            return {
                notes: subtopic.notes || [],
            };
        }

        const unlocked = await strapi.db
            .query("api::user-unlocked-subject.user-unlocked-subject")
            .findOne({
                where: {
                    student: { id: user.id },
                    grade_subject: { id: gradeSubjectId },
                    status: "active",
                },
            });

        if (!unlocked) {
            return ctx.forbidden("Subject not unlocked");
        }

        // 4️⃣ Return notes
        return {
            notes: subtopic.notes || [],
        };
    }

};

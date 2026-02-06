"use strict";

module.exports = {
    async contentPlan(ctx) {
        const user = ctx.state.user;
        if (!user) return ctx.unauthorized();

        // 1️⃣ Fetch latest active plan
        const activePlan = await strapi.db
            .query("api::user-content-plan.user-content-plan")
            .findOne({
                where: {
                    student: user.id,
                    status: "active",
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

        // 2️⃣ Lazy expiry check
        const isExpired =
            activePlan.expires_at &&
            new Date(activePlan.expires_at) < new Date();

        if (isExpired) {
            // 🔁 Idempotent mutation (safe to run multiple times)
            await strapi.db
                .query("api::user-content-plan.user-content-plan")
                .update({
                    where: { id: activePlan.id },
                    data: { status: "expired" },
                });

            await strapi.db
                .query("api::user-unlocked-subject.user-unlocked-subject")
                .updateMany({
                    where: {
                        user_content_plan: activePlan.id,
                        status: "active",
                    },
                    data: { status: "expired" },
                });

            return {
                plan: null,
                unlocked_subject_ids: [],
            };
        }

        // 3️⃣ Fetch active unlocked subjects
        const unlockedSubjects = await strapi.db
            .query("api::user-unlocked-subject.user-unlocked-subject")
            .findMany({
                where: {
                    student: user.id,
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
    }

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
                            subtopics: { sort: ["id:asc"] },
                        },
                    },
                    notes: true, // manyToMany → note
                },
            }
        );

        if (!subtopic) return ctx.notFound("Subtopic not found");

        const gradeSubjectId = subtopic.topic?.grade_subject?.id;
        if (!gradeSubjectId) return ctx.badRequest("Invalid subtopic mapping");

        // ✅ preview logic (position-based)
        const isFree = subtopic.topic.subtopics?.[0]?.id === subtopic.id;

        if (!isFree) {
            const unlocked = await strapi.db
                .query("api::user-unlocked-subject.user-unlocked-subject")
                .findOne({
                    where: {
                        student: user.id,
                        grade_subject: gradeSubjectId,
                        status: "active",
                    },
                });

            if (!unlocked) {
                return ctx.forbidden("Subject not unlocked");
            }
        }

        // ✅ CORRECT mapping
        return {
            notes: subtopic.notes.map((n) => ({
                id: n.id,
                attributes: {
                    title: n.title,
                    note: n.note,
                },
            })),
        };
    }




};

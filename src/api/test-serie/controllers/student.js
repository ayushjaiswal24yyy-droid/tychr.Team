"use strict";

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::test-serie.test-serie",
  ({ strapi }) => ({
    async getStudentTestSeries(ctx) {
      try {
        const { classroomId } = ctx.params;
        const user = ctx.state.user;

        if (!classroomId) {
          return ctx.badRequest("Classroom ID is required");
        }

        // Get classroom with grade_subject
        const classroom = await strapi.entityService.findOne(
          "api::enrollment.enrollment",
          classroomId,
          {
            populate: ["grade_subject"],
          }
        );

        if (!classroom) {
          return ctx.notFound("Classroom not found");
        }

        const gradeSubjectId = classroom.grade_subject?.id;

        if (!gradeSubjectId) {
          return { data: [] };
        }

        // Get test series for this grade subject
        const testSeries = await strapi.entityService.findMany(
          "api::test-serie.test-serie",
          {
            filters: {
              grade_subject: { id: gradeSubjectId },
            },
            populate: {
              question_banks: {
                fields: ["id", "question_type"],
              },
              test_papers: true,
              grade_subject: {
                fields: ["id", "name"],
              },
            },
            sort: { createdAt: "desc" },
          }
        );

        // Transform data to include only necessary fields
        const transformedData = testSeries.map((series) => ({
          id: series.id,
          title: series.title,
          program_type: series.program_type,
          test_mode: series.test_mode,
          test_type: series.test_type,
          year: series.year,
          test_duration: series.test_duration,
          instructions: series.instructions,
          pass_mark: series.pass_mark,
          is_global: series.is_global,
          question_banks: series.question_banks?.map((qb) => ({
            id: qb.id,
            question_type: qb.question_type,
          })),
          test_papers: series.test_papers,
          grade_subject: series.grade_subject
            ? {
                id: series.grade_subject.id,
                name: series.grade_subject.name,
              }
            : null,
          createdAt: series.createdAt,
          updatedAt: series.updatedAt,
        }));

        return { data: transformedData, sucess: true };
      } catch (error) {
        ctx.throw(500, error.message);
      }
    },
  })
);

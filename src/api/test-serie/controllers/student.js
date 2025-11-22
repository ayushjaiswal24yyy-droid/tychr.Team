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

        if (!user) {
          return ctx.unauthorized("User not authenticated");
        }

        // Get classroom with grade_subject
        const classroom = await strapi.entityService.findOne(
          "api::enrollment.enrollment",
          classroomId,
          {
            populate: ["grade_subject", "students"],
          }
        );

        if (!classroom) {
          return ctx.notFound("Classroom not found");
        }

        // Check if user is enrolled in this classroom
        const isStudentEnrolled = classroom.students?.some(
          (student) => student.id === user.id
        );
        if (!isStudentEnrolled) {
          return ctx.forbidden("You are not enrolled in this classroom");
        }

        const gradeSubjectId = classroom.grade_subject?.id;

        if (!gradeSubjectId) {
          return { data: [] };
        }

        // Get test series for this grade subject with answers
        const testSeries = await strapi.entityService.findMany(
          "api::test-serie.test-serie",
          {
            filters: {
              grade_subject: { id: gradeSubjectId },
            },
            populate: {
              question_banks: {
                fields: ["id", "question_type", "question", "marks"], // Removed 'title', added 'question' and 'marks'
              },
              test_papers: true,
              grade_subject: {
                fields: ["id", "name"],
              },
              answers: {
                filters: {
                  student: user.id,
                },
                fields: [
                  "id",
                  "submission_date",
                  "marks",
                  "evaluation_status",
                  "completed",
                  "time_taken",
                ],
                populate: {
                  student: {
                    fields: ["id", "username"],
                  },
                },
              },
            },
            sort: { createdAt: "desc" },
          }
        );

        // Transform data to include answer status
        const transformedData = testSeries.map((series) => {
          const userAnswers = series.answers || [];
          const hasSubmitted = userAnswers.length > 0;
          const latestAnswer = hasSubmitted
            ? userAnswers.reduce((latest, current) => {
                if (!latest) return current;
                return new Date(current.submission_date) >
                  new Date(latest.submission_date)
                  ? current
                  : latest;
              }, null)
            : null;

          const completedAnswers = userAnswers.filter(
            (answer) => answer.completed
          );
          const evaluatedAnswers = completedAnswers.filter(
            (answer) => answer.evaluation_status === "evaluated"
          );

          return {
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
              question: qb.question, // Using 'question' instead of 'title'
              marks: qb.marks,
            })),
            test_papers: series.test_papers,
            grade_subject: series.grade_subject
              ? {
                  id: series.grade_subject.id,
                  name: series.grade_subject.name,
                }
              : null,
            // Answer related information
            answer_status: {
              has_attempted: hasSubmitted,
              total_attempts: userAnswers.length,
              completed_attempts: completedAnswers.length,
              evaluated_attempts: evaluatedAnswers.length,
              latest_attempt: latestAnswer
                ? {
                    id: latestAnswer.id,
                    submission_date: latestAnswer.submission_date,
                    marks: latestAnswer.marks,
                    evaluation_status: latestAnswer.evaluation_status,
                    time_taken: latestAnswer.time_taken,
                    completed: latestAnswer.completed,
                  }
                : null,
              all_attempts: userAnswers.map((answer) => ({
                id: answer.id,
                submission_date: answer.submission_date,
                marks: answer.marks,
                evaluation_status: answer.evaluation_status,
                time_taken: answer.time_taken,
                completed: answer.completed,
              })),
            },
            createdAt: series.createdAt,
            updatedAt: series.updatedAt,
          };
        });

        return { data: transformedData };
      } catch (error) {
        console.error("Error in getStudentTestSeries:", error);
        ctx.throw(500, error.message);
      }
    },
  })
);

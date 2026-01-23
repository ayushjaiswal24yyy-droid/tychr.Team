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
              test_type: { $eq: "Test Series" },
              publishedAt: { $notNull: true },
              entity_type: { $in: "series" },
            },
            populate: {
              question_banks: {
                fields: ["id", "question_type", "question", "marks"],
              },
              papers: true,
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
        const now = new Date();
        // Transform data to include answer status
        const transformedData = testSeries.map((series) => {
          const startDate = series.start_date ? new Date(series.start_date) : null;
          const isUnlocked = !startDate || startDate <= now;

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

          if (!isUnlocked) {
            // 🔒 UPCOMING TEST → send limited data
            return {
              id: series.id,
              title: series.title,
              program_type: series.program_type,
              test_mode: series.test_mode,
              test_type: series.test_type,
              year: series.year,
              test_duration: series.test_duration,
              start_date: series.start_date,
              status: "upcoming",
              is_locked: true,
            };
          }
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
              question: qb.question,
              marks: qb.marks,
            })),
            papers: series.papers,
            grade_subject: series.grade_subject
              ? {
                id: series.grade_subject.id,
                name: series.grade_subject.name,
              }
              : null,
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
    async getStudentPracticeSeries(ctx) {
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
              test_type: { $eq: "Practice Test" },

            },
            populate: {
              question_banks: {
                fields: ["id", "question_type", "question", "marks"],
              },
              papers: true,
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
              question: qb.question,
              marks: qb.marks,
            })),
            papers: series.papers,
            grade_subject: series.grade_subject
              ? {
                id: series.grade_subject.id,
                name: series.grade_subject.name,
              }
              : null,
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
    async getStudentTestResults(ctx) {
      try {
        const { testSeriesId } = ctx.params;
        const user = ctx.state.user;

        if (!testSeriesId) {
          return ctx.badRequest("Test Series ID is required");
        }

        if (!user) {
          return ctx.unauthorized("User not authenticated");
        }

        /**
         * 1. Fetch SERIES with PAPERS + QUESTIONS
         */
        const series = await strapi.entityService.findOne(
          "api::test-serie.test-serie",
          testSeriesId,
          {
            populate: {
              papers: {
                populate: {
                  question_banks: {
                    populate: ["parts", "attachments"],
                  },
                },
              },
              grade_subject: {
                fields: ["id", "name"],
              },
            },
          }
        );

        if (!series) {
          return ctx.notFound("Test series not found");
        }

        if (!series.papers || series.papers.length === 0) {
          return ctx.badRequest("No papers found for this test series");
        }

        /**
         * 2. Fetch ALL ANSWERS for ALL PAPERS
         *    (attempt_id is the key 🔑)
         */
        const paperIds = series.papers.map(p => p.id);

        const answers = await strapi.entityService.findMany(
          "api::answer.answer",
          {
            filters: {
              student: user.id,
              test_series: { id: { $in: paperIds } },
              completed: true,
            },
            populate: {
              test_series: {
                fields: ["id", "title"],
              },
              question_n_answer: {
                populate: {
                  question: {
                    populate: ["parts", "attachments"],
                  },
                },
              },
              uploaded_answer_sheet: true,
            },
            sort: { submission_date: "asc" },
          }
        );

        /**
         * 3. Group ANSWERS BY attempt_id
         */
        const attemptsMap = {};

        for (const ans of answers) {
          if (!ans.attempt_id) continue;

          if (!attemptsMap[ans.attempt_id]) {
            attemptsMap[ans.attempt_id] = {
              attempt_id: ans.attempt_id,
              submission_date: ans.submission_date,
              papers: [],
            };
          }

          attemptsMap[ans.attempt_id].papers.push(ans);
        }

        /**
         * 4. Transform attempts → frontend format
         */
        /**
   * 4. Transform attempts → frontend format
   */
        const attempts = Object.values(attemptsMap).map((attempt, index) => {
          const totalMarks = attempt.papers.reduce(
            (sum, p) => sum + (p.marks || 0),
            0
          );

          const totalTime = attempt.papers.reduce(
            (sum, p) => sum + (p.time_taken || 0),
            0
          );

          const evaluationStatus = attempt.papers.every(
            p => p.evaluation_status === "evaluated"
          )
            ? "evaluated"
            : "pending";

          // ✅ correct submission date = latest paper submission
          const submissionDate = attempt.papers
            .map(p => new Date(p.submission_date))
            .sort((a, b) => b - a)[0];

          return {
            attempt_no: index + 1,
            attempt_id: attempt.attempt_id,
            submission_date: submissionDate,
            total_marks: totalMarks,
            time_taken: totalTime,
            evaluation_status: evaluationStatus,
            completed: true,

            papers: attempt.papers.map(paperAnswer => ({
              id: paperAnswer.id,
              paper_id: paperAnswer.test_series.id,
              paper_title: paperAnswer.test_series.title,
              marks: paperAnswer.marks,
              time_taken: paperAnswer.time_taken,
              submission_type: paperAnswer.submission_type,
              uploaded_answer_sheet: paperAnswer.uploaded_answer_sheet,

              question_answers: paperAnswer.question_n_answer?.map(qna => ({
                question_id: qna.question?.id,
                question: qna.question?.question,
                question_type: qna.question?.question_type,
                marks: qna.question?.marks,
                student_answer: qna.answer,
                correct_answer: qna.question?.parts?.find(
                  part => part.is_correct
                )?.content,
                evaluated_marks: qna.evaluated_marks,
                feedback: qna.feedback,
              })),
            })),
          };
        });


        /**
         * 5. Aggregate QUESTIONS & MARKS (SERIES LEVEL)
         */
        const allQuestions = series.papers.flatMap(
          p => p.question_banks || []
        );

        const totalMarks = allQuestions.reduce(
          (sum, q) => sum + (q.marks || 0),
          0
        );

        /**
         * 6. FINAL RESPONSE
         */

    

        return {
          data: {
            id: series.id,
            title: series.title,
            test_type: series.test_type,
            test_mode: series.test_mode,
            test_duration: series.test_duration,
            program_type: series.program_type,
            grade_subject: series.grade_subject,

            total_questions: allQuestions.length,
            total_marks: totalMarks,

            attempts,
          },
        };

      } catch (error) {
        console.error("Error in getStudentTestResults:", error);
        ctx.throw(500, error.message);
      }
    },

    async getStudentSeriesSession(ctx) {
      try {
        const { seriesId } = ctx.params;
        const user = ctx.state.user;

        if (!seriesId) {
          return ctx.badRequest("Series ID is required");
        }

        if (!user) {
          return ctx.unauthorized("User not authenticated");
        }

        /**
         * 1. Fetch parent series with papers
         */
        const series = await strapi.entityService.findOne(
          "api::test-serie.test-serie",
          seriesId,
          {
            filters: {
              publishedAt: { $notNull: true },
            },
            populate: {
              papers: {
                sort: { createdAt: "asc" },
              },
            },

          }
        );

        if (!series) {
          return ctx.notFound("Test series not found");
        }

        if (!series.papers || series.papers.length === 0) {
          return ctx.badRequest("No papers found for this series");
        }

        /**
         * 2. Fetch all submitted answers for papers (session-bound)
         */
        const paperIds = series.papers.map((p) => p.id);
        const answers = await strapi.entityService.findMany(
          "api::answer.answer",
          {
            publicationState: "preview",
            filters: {
              student: user.id,
              test_series: { id: { $in: paperIds } },
              completed: true,
            },
            fields: ["id", "time_taken", "marks"],
            populate: {
              test_series: {
                fields: ["id"],
              },
            },
          }
        );

        const answerByPaperId = {};
        let totalTimeTaken = 0;

        for (const ans of answers) {
          const paperId = ans.test_series?.id;
          if (!paperId) continue;

          answerByPaperId[paperId] = {
            id: ans.id,
            time_taken: ans.time_taken || 0,
            marks: ans.marks,
          };

          totalTimeTaken += ans.time_taken || 0;
        }


        /**
         * 4. Compute remaining time (series-level)
         */
        const totalDurationSeconds = (series.test_duration || 0) * 60;

        const remainingTime = Math.max(
          totalDurationSeconds - totalTimeTaken,
          0
        );

        /**
         * 5. Compute paper statuses (SEQUENTIAL UNLOCK)
         */
        let activePaperAssigned = false;

        const papers = series.papers.map((paper) => {
          if (answerByPaperId[paper.id]) {
            return {
              id: paper.id,
              title: paper.title,
              status: "submitted",
              marks: answerByPaperId[paper.id].marks,
            };
          }

          return {
            id: paper.id,
            title: paper.title,
            status: "active",
          };
        });


        /**
         * 6. Series completion check
         */
        const completed =
          papers.every((p) => p.status === "submitted") ||
          remainingTime === 0;

        /**
         * 7. Final response
         */
        return {
          data: {
            series: {
              id: series.id,
              title: series.title,
              instructions: series.instructions,
              total_duration: totalDurationSeconds,
            },
            remaining_time: remainingTime,
            papers,
            completed,
          },
        };
      } catch (error) {
        console.error("Error in getStudentSeriesSession:", error);
        ctx.throw(500, error.message);
      }
    }

  })
);

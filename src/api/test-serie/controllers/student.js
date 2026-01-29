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
            instructions: series.instruction_booklet,
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
            instructions: series.instruction_booklet,
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
              is_attempt_marker: { $ne: true },

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
                  part_evaluations: {
                    populate: true,
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
        * 4. Transform attempts → frontend format
        */
        const attempts = Object.values(attemptsMap).sort((a, b) => a.attempt_id - b.attempt_id).map((attempt, index) => {
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

          const completed = attempt.papers.length === series.papers.length;
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
            completed,
            questions: allQuestions.map(q => ({
              id: q.id,
              diagram: q.diagram,
              parts: q.parts || [],
              question: q.question,
              marks: q.marks,
              question_type: q.question_type,
            })),
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
                parts: qna.question?.parts || [],
                question_type: qna.question?.question_type,
                marks: qna.question?.marks,
                student_answer: qna.answer,
                part_evaluations: qna.part_evaluations?.map(pe => ({
                  part_index: pe.part_index,
                  awarded_marks: pe.awarded_marks,
                  feedback: pe.feedback,
                })) || [],
                awarded_marks: qna.question_awarded_marks ?? 0,
                feedback: qna.feedback,
              })),
            })),
          };
        });




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

        /* ----------------------------------------
           1. Basic validation
        ---------------------------------------- */
        if (!seriesId) {
          return ctx.badRequest("Series ID is required");
        }

        if (!user) {
          return ctx.unauthorized("User not authenticated");
        }

        /* ----------------------------------------
           2. Fetch series with papers
        ---------------------------------------- */
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
                populate: {
                  instruction_booklet: true, // 👈 if instructions is Media
                },
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

        const paperIds = series.papers.map((p) => p.id);

        /* ----------------------------------------
      3. Fetch current attempt marker
   ---------------------------------------- */
        const attemptMarkers = await strapi.entityService.findMany(
          "api::answer.answer",
          {
            filters: {
              student: user.id,
              test_series: series.id,
              is_attempt_marker: true,
            },
            sort: { attempt_id: "desc" },
            limit: 1,
            fields: ["attempt_id", "completed"],
          }
        );

        const hasAttempt = attemptMarkers.length > 0;
        const currentAttemptId = hasAttempt ? attemptMarkers[0].attempt_id : 0;
        let attemptCompleted = hasAttempt ? attemptMarkers[0].completed : false;

        /* ----------------------------------------
           4. Fetch answers for CURRENT attempt
        ---------------------------------------- */
        const answers = hasAttempt
          ? await strapi.entityService.findMany("api::answer.answer", {
            publicationState: "preview",
            filters: {
              student: user.id,
              test_series: { id: { $in: paperIds } },
              attempt_id: currentAttemptId,
              completed: true,
              is_attempt_marker: { $ne: true },
            },
            fields: ["id", "time_taken", "marks"],
            populate: {
              test_series: { fields: ["id"] },
            },
          })
          : [];


        /* ----------------------------------------
           5. Index answers by paper & sum time
        ---------------------------------------- */
        const answerByPaperId = {};
        let totalTimeTaken = 0;

        for (const ans of answers) {
          const paperId = ans.test_series?.id;
          if (!paperId) continue;

          answerByPaperId[paperId] = {
            id: ans.id,
            marks: ans.marks,
            time_taken: ans.time_taken || 0,
          };

          totalTimeTaken += ans.time_taken || 0;
        }

        /* ----------------------------------------
           6. Compute remaining series time
        ---------------------------------------- */
        const totalDurationSeconds = (series.test_duration || 0) * 60;

        const remainingTime = hasAttempt
          ? Math.max(totalDurationSeconds - totalTimeTaken, 0)
          : totalDurationSeconds;




        /* ----------------------------------------
           7. Compute paper statuses (attempt-aware)
        ---------------------------------------- */
        const papers = series.papers.map((paper) => {
          if (!hasAttempt || attemptCompleted) {
            return {
              id: paper.id,
              title: paper.title,
              status: "locked",
              instructions: paper.instruction_booklet,
            };
          }

          const answer = answerByPaperId[paper.id];

          if (answer) {
            return {
              id: paper.id,
              title: paper.title,
              status: "submitted",
              instructions: paper.instruction_booklet,
              marks: answer.marks,
            };
          }

          return {
            id: paper.id,
            title: paper.title,
            instructions: paper.instruction_booklet,
            status: "active",
          };
        });

        /* ----------------------------------------
           8. Auto-end attempt if all papers submitted
        ---------------------------------------- */
        if (
          hasAttempt &&
          !attemptCompleted &&
          answers.length === series.papers.length
        ) {
          await strapi.entityService.update(
            "api::answer.answer",
            attemptMarkers[0].id,
            {
              data: { completed: true },
            }
          );

          attemptCompleted = true;
        }



        /* ----------------------------------------
           9. Final response
        ---------------------------------------- */
        return {
          data: {
            attempt_id: currentAttemptId,
            series: {
              id: series.id,
              title: series.title,
              instructions: series.instruction_booklet,
              total_duration: totalDurationSeconds,
            },
            remaining_time: remainingTime,
            papers,
            completed: attemptCompleted,
          },
        };
      } catch (error) {
        console.error("Error in getStudentSeriesSession:", error);
        ctx.throw(500, error.message);
      }
    },
    async startNewAttempt(ctx) {
      try {
        const { seriesId } = ctx.params;
        const user = ctx.state.user;

        if (!seriesId || !user) {
          return ctx.badRequest("Invalid request");
        }

        // 🔑 ONLY look at attempt markers
        const lastAttempt = await strapi.entityService.findMany(
          "api::answer.answer",
          {
            filters: {
              student: user.id,
              test_series: seriesId,
              is_attempt_marker: true,
            },
            sort: { attempt_id: "desc" },
            limit: 1,
            fields: ["attempt_id", "completed"],
          }
        );

        const nextAttemptId =
          lastAttempt.length > 0 ? lastAttempt[0].attempt_id + 1 : 1;

        // Create new attempt marker
        await strapi.entityService.create("api::answer.answer", {
          data: {
            student: user.id,
            test_series: seriesId,
            attempt_id: nextAttemptId,
            completed: false,
            is_attempt_marker: true,
          },
        });

        return { data: { attempt_id: nextAttemptId } };
      } catch (error) {
        ctx.throw(500, error.message);
      }
    },

    async endAttempt(ctx) {
      const { seriesId } = ctx.params;
      const user = ctx.state.user;

      const marker = await strapi.entityService.findMany(
        "api::answer.answer",
        {
          filters: {
            student: user.id,
            test_series: seriesId,
            is_attempt_marker: true,
            completed: false,
          },
          limit: 1,
        }
      );

      if (!marker.length) return;

      await strapi.entityService.update(
        "api::answer.answer",
        marker[0].id,
        {
          data: { completed: true },
        }
      );
    },

    async getPaperSubmissions(ctx) {
      try {
        const { id: testSeriesId } = ctx.params;
        const user = ctx.state.user;

        if (!testSeriesId) {
          return ctx.badRequest("Test Series ID is required");
        }

        if (!user || user.role?.name !== "Tutor") {
          return ctx.unauthorized("Only tutors can access this endpoint");
        }

        /**
         * 1️⃣ Fetch Test Series with Papers + Questions
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
            },
          }
        );

        if (!series) {
          return ctx.notFound("Test series not found");
        }

        if (!series.papers?.length) {
          return ctx.badRequest("No papers found for this test series");
        }

        const paperIds = series.papers.map(p => p.id);

        /**
         * 2️⃣ Fetch ALL answers for ALL papers (ALL students)
         */
        const answers = await strapi.entityService.findMany(
          "api::answer.answer",
          {
            filters: {
              test_series: { id: { $in: paperIds } },
              is_attempt_marker: { $ne: true },
            },
            populate: {
              student: {
                fields: ["id", "fullName", "email"],
                populate: ["avatar"],
              },
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
            sort: { submission_date: "desc" },
          }
        );

        /**
         * 3️⃣ Group answers by PAPER
         */
        const paperMap = {};

        for (const paper of series.papers) {
          paperMap[paper.id] = {
            paper_id: paper.id,
            paper_title: paper.title,
            total_marks: paper.question_banks.reduce(
              (sum, q) => sum + (q.marks || 0),
              0
            ),
            questions: paper.question_banks.map(q => ({
              id: q.id,
              question: q.question,
              diagram: q.diagram,
              marks: q.marks,
              question_type: q.question_type,
              parts: q.parts,
              attachments: q.attachments,
            })),
            submissions: [],
          };
        }

        /**
         * 4️⃣ Attach submissions to their paper
         */
        for (const ans of answers) {
          const paperId = ans.test_series?.id;
          if (!paperMap[paperId]) continue;

          paperMap[paperId].submissions.push({
            id: ans.id,
            submission_date: ans.submission_date,
            attempt_id: ans.attempt_id,
            submission_type: ans.submission_type,
            time_taken: ans.time_taken,
            marks: ans.marks,
            evaluation_status: ans.evaluation_status,
            tutor_feedback: ans.tutor_feedback,
            student: ans.student && {
              id: ans.student.id,
              name: ans.student.fullName,
              email: ans.student.email,
              avatar: ans.student.avatar,
            },
            uploaded_answer_sheet: ans.uploaded_answer_sheet,
            question_answers: ans.question_n_answer?.map(qna => ({
              question_id: qna.question?.id,
              question: qna.question?.question,
              question_type: qna.question?.question_type,
              marks: qna.question?.marks,
              student_answer: qna.answer,
              evaluated_marks: qna.evaluated_marks,
              feedback: qna.feedback,
            })),
          });
        }

        /**
         * 5️⃣ Final Response
         */
        return {
          data: {
            id: series.id,
            title: series.title,
            papers: Object.values(paperMap),
          },
        };

      } catch (error) {
        console.error("Error in getPaperSubmissions:", error);
        ctx.throw(500, error.message);
      }
    }




  })
);

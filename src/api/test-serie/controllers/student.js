"use strict";

const { createCoreController } = require("@strapi/strapi").factories;

const getNumberParam = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

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
          const startDate = series.start_date
            ? new Date(series.start_date)
            : null;
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
    async getStudentTestSeriesByGrade(ctx) {
      try {
        const { gradeSubjectId } = ctx.params;
        const user = ctx.state.user;

        if (!gradeSubjectId) {
          return ctx.badRequest("Grade subject ID is required");
        }

        if (!user) {
          return ctx.unauthorized("User not authenticated");
        }

        const testSeries = await strapi.entityService.findMany(
          "api::test-serie.test-serie",
          {
            filters: {
              grade_subject: { id: gradeSubjectId },
              test_type: { $eq: "Test Series" },
              entity_type: { $eq: "series" },
              publishedAt: { $notNull: true },
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
              },
            },
            sort: { createdAt: "desc" },
          }
        );

        const now = new Date();

        const transformedData = testSeries.map((series) => {
          const startDate = series.start_date
            ? new Date(series.start_date)
            : null;
          const isUnlocked = !startDate || startDate <= now;

          const userAnswers = series.answers || [];
          const hasSubmitted = userAnswers.length > 0;

          const latestAnswer = hasSubmitted
            ? userAnswers.reduce((latest, current) =>
                new Date(current.submission_date) >
                new Date(latest.submission_date)
                  ? current
                  : latest
              )
            : null;

          const completedAnswers = userAnswers.filter((a) => a.completed);
          const evaluatedAnswers = completedAnswers.filter(
            (a) => a.evaluation_status === "evaluated"
          );

          if (!isUnlocked) {
            return {
              id: series.id,
              title: series.title,
              test_mode: series.test_mode,
              test_type: series.test_type,
              test_duration: series.test_duration,
              start_date: series.start_date,
              status: "upcoming",
              is_locked: true,
            };
          }

          return {
            id: series.id,
            title: series.title,
            test_mode: series.test_mode,
            test_type: series.test_type,
            test_duration: series.test_duration,
            question_banks: series.question_banks,
            papers: series.papers,
            grade_subject: series.grade_subject,
            answer_status: {
              has_attempted: hasSubmitted,
              total_attempts: userAnswers.length,
              completed_attempts: completedAnswers.length,
              evaluated_attempts: evaluatedAnswers.length,
              latest_attempt: latestAnswer,
              all_attempts: userAnswers,
            },
            createdAt: series.createdAt,
          };
        });

        return { data: transformedData };
      } catch (error) {
        console.error("Error in getStudentTestSeriesByGrade:", error);
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
        const { studentId, attemptId, classroomId } = ctx.query;
        const user = ctx.state.user;
        const attemptIdNum = getNumberParam(attemptId);
        const requestedStudentId = getNumberParam(studentId);

        if (attemptId && attemptIdNum === null) {
          return ctx.badRequest("Invalid attemptId");
        }

        if (!testSeriesId) {
          return ctx.badRequest("Test Series ID is required");
        }

        if (!user) {
          return ctx.unauthorized("User not authenticated");
        }

        let targetStudentId = user.id;
        let classroom = null;
        let tutorEnrollmentIds = null;

        if (requestedStudentId && requestedStudentId !== user.id) {
          targetStudentId = requestedStudentId;

          if (classroomId) {
            classroom = await strapi.entityService.findOne(
              "api::enrollment.enrollment",
              classroomId,
              {
                populate: ["tutor", "assistant", "students", "grade_subject"],
              }
            );

            if (!classroom) return ctx.notFound("Classroom not found");

            const isTutor = classroom.tutor?.id === user.id;
            const isAssistant = classroom.assistant?.id === user.id;
            if (!isTutor && !isAssistant) {
              strapi.log.info("tutor_results_auth_denied", {
                reason: "not_tutor_or_assistant",
                userId: user.id,
                classroomId,
                studentId: requestedStudentId,
              });
              return ctx.forbidden("You are not authorized to view this student.");
            }

            const studentInClassroom = classroom.students?.some(
              (student) => student.id === requestedStudentId
            );
            if (!studentInClassroom) {
              strapi.log.info("tutor_results_auth_denied", {
                reason: "student_not_in_classroom",
                userId: user.id,
                classroomId,
                studentId: requestedStudentId,
              });
              return ctx.forbidden("Student is not in your classroom.");
            }
          } else {
            const tutorEnrollments = await strapi.entityService.findMany(
              "api::enrollment.enrollment",
              {
                filters: {
                  $or: [
                    { tutor: { id: { $eq: user.id } } },
                    { assistant: { id: { $eq: user.id } } },
                  ],
                  students: { id: { $eq: requestedStudentId } },
                },
                fields: ["id"],
                pagination: { limit: -1 },
              }
            );

            tutorEnrollmentIds = tutorEnrollments.map((e) => e.id);
            if (tutorEnrollmentIds.length === 0) {
              strapi.log.info("tutor_results_auth_denied", {
                reason: "no_shared_classroom",
                userId: user.id,
                studentId: requestedStudentId,
              });
              return ctx.forbidden("You are not authorized to view this student.");
            }
          }
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

        if (classroom) {
          const classroomGradeSubjectId = classroom.grade_subject?.id ?? null;
          const seriesGradeSubjectId = series.grade_subject?.id ?? null;
          if (classroomGradeSubjectId && seriesGradeSubjectId && classroomGradeSubjectId !== seriesGradeSubjectId) {
            strapi.log.info("tutor_results_auth_denied", {
              reason: "series_not_in_classroom",
              userId: user.id,
              classroomId,
              seriesId: testSeriesId,
            });
            return ctx.forbidden("Test series does not belong to this classroom.");
          }
        }

        if (!series.papers || series.papers.length === 0) {
          return ctx.badRequest("No papers found for this test series");
        }

        /**
         * 2. Fetch ALL ANSWERS for ALL PAPERS
         *    (attempt_id is the key 🔑)
         */
        const paperIds = series.papers.map((p) => p.id);

        if (requestedStudentId && requestedStudentId !== user.id && !classroomId && tutorEnrollmentIds?.length) {
          const accessCheckFilters = {
            student: targetStudentId,
            test_series: { id: { $in: paperIds } },
            is_attempt_marker: { $ne: true },
            tutor_classroom: { id: { $in: tutorEnrollmentIds } },
          };

          if (attemptIdNum) {
            accessCheckFilters.attempt_id = attemptIdNum;
          }

          const accessCheck = await strapi.entityService.findMany(
            "api::answer.answer",
            {
              filters: accessCheckFilters,
              fields: ["id"],
              limit: 1,
            }
          );

          if (!accessCheck.length) {
            strapi.log.info("tutor_results_auth_denied", {
              reason: "no_submission_in_tutor_classroom",
              userId: user.id,
              studentId: requestedStudentId,
              seriesId: testSeriesId,
              attemptId: attemptIdNum ?? null,
            });
            return ctx.forbidden("You are not authorized to view this student.");
          }
        }

        const answerFilters = {
          student: targetStudentId,
          test_series: { id: { $in: paperIds } },
          completed: true,
          is_attempt_marker: { $ne: true },
        };

        if (attemptIdNum) {
          answerFilters.attempt_id = attemptIdNum;
        }

        if (classroomId) {
          answerFilters.tutor_classroom = { id: { $eq: classroomId } };
        } else if (requestedStudentId && requestedStudentId !== user.id && tutorEnrollmentIds?.length) {
          answerFilters.tutor_classroom = { id: { $in: tutorEnrollmentIds } };
        }

        const answers = await strapi.entityService.findMany(
          "api::answer.answer",
          {
            filters: answerFilters,
            populate: {
              test_series: {
                fields: ["id", "title"],
              },
              question_n_answer: {
                populate: {
                  question: {
                    populate: ["parts", "attachments"],
                  },
                  part_evaluations: true,
                  question_audio_feedback: true,
                },
              },
              uploaded_answer_sheet: true,
              audio_feedback: true,
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
          (p) => p.question_banks || []
        );

        const totalMarks = allQuestions.reduce(
          (sum, q) => sum + (q.marks || 0),
          0
        );
        /**
         * 4. Transform attempts → frontend format
         */
        const attempts = Object.values(attemptsMap)
          .sort((a, b) => a.attempt_id - b.attempt_id)
          .map((attempt, index) => {
            const totalMarks = attempt.papers.reduce(
              (sum, p) => sum + (p.marks || 0),
              0
            );

            const totalTime = attempt.papers.reduce(
              (sum, p) => sum + (p.time_taken || 0),
              0
            );

            const evaluationStatus = attempt.papers.every(
              (p) => p.evaluation_status === "evaluated"
            )
              ? "evaluated"
              : "pending";

            const completed = attempt.papers.length === series.papers.length;
            // ✅ correct submission date = latest paper submission

            const submissionDate = attempt.papers
              .map((p) => new Date(p.submission_date))
              .sort((a, b) => b - a)[0];

            return {
              attempt_no: index + 1,
              attempt_id: attempt.attempt_id,
              submission_date: submissionDate,
              total_marks: totalMarks,
              time_taken: totalTime,
              evaluation_status: evaluationStatus,
              completed,
              questions: allQuestions.map((q) => ({
                id: q.id,
                diagram: q.diagram,
                parts: q.parts || [],
                question: q.question,
                marks: q.marks,
                question_type: q.question_type,
              })),
              papers: attempt.papers.map((paperAnswer) => ({
                id: paperAnswer.id,
                paper_id: paperAnswer.test_series.id,
                paper_title: paperAnswer.test_series.title,
                marks: paperAnswer.marks,
                time_taken: paperAnswer.time_taken,
                submission_type: paperAnswer.submission_type,
                uploaded_answer_sheet: paperAnswer.uploaded_answer_sheet,
                audio_feedback: paperAnswer.audio_feedback ?? null, // ← add
                question_answers: paperAnswer.question_n_answer?.map((qna) => ({
                  question_id: qna.question?.id,
                  question: qna.question?.question,
                  parts: qna.question?.parts || [],
                  question_type: qna.question?.question_type,
                  annotations: qna.annotations ?? null,
                  improved_answer: qna.improved_answer ?? null,
                  criterion_breakdown: qna.criterion_breakdown ?? null,
                  structure_score: qna.structure_score ?? null,
                  marks: qna.question?.marks,
                  student_answer: qna.answer,
                  part_evaluations:
                    qna.part_evaluations?.map((pe) => ({
                      part_index: pe.part_index,
                      awarded_marks: pe.awarded_marks,
                      feedback: pe.feedback,
                      audio_feedback: pe.audio_feedback ?? null, // ← pe-level audio (part feedback)
                    })) || [],
                  awarded_marks: qna.question_awarded_marks ?? 0,
                  feedback: qna.question_feedback,
                  audio_feedback: qna.question_audio_feedback ?? null, // ← qna-level audio ✓
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

        // Get all attempt markers to count total attempts
        const allAttemptMarkers = await strapi.entityService.findMany(
          "api::answer.answer",
          {
            filters: {
              student: user.id,
              test_series: seriesId,
              is_attempt_marker: true,
            },
            sort: { attempt_id: "desc" },
            fields: [
              "attempt_id",
              "completed",
              "phase",
              "phase_started_at",
              "started_at",
              "violation_count",
              "auto_submitted",
              "resume_status",
            ],
          }
        );

        const hasAttempt = allAttemptMarkers.length > 0;
        const totalAttempts = allAttemptMarkers.length; // ✅ Total number of attempts
        const currentAttemptId = hasAttempt
          ? allAttemptMarkers[0].attempt_id
          : 0;
        let attemptCompleted = hasAttempt
          ? allAttemptMarkers[0].completed
          : false;
        const shouldIncludeQuestions = hasAttempt;

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
                  instruction_booklet: true,
                  ...(hasAttempt && {
                    question_banks: {
                      populate: {
                        parts: {
                          fields: [
                            "id",
                            "question_text",
                            "options",
                            "content_format",
                            "marks",
                            "answer_type",
                          ],
                        },
                        diagram: true,
                      },
                      fields: ["id", "question_type", "question"],
                    },
                  }),
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
       3. Fetch answers for CURRENT attempt
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
       4. Index answers by paper & sum time
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

        let marker = null;
        let phase = null;
        let phaseStartedAt = null;
        let violationCount = 0;
        let maxViolations = 3;
        let autoSubmitted = false;
        let resumeStatus = "none";

        if (hasAttempt) {
          marker = allAttemptMarkers[0];

          phase = marker.phase;
          phaseStartedAt = new Date(marker.phase_started_at);

          violationCount = marker.violation_count || 0;
          maxViolations = 3;
          autoSubmitted = marker.auto_submitted || false;
          resumeStatus = marker.resume_status || "none";
          if (resumeStatus === "approved") {
            autoSubmitted = false;
            attemptCompleted = false;
            if (phase === "completed") {
              phase = "answering";
            }
          }
        }

        const now = new Date();
        const readingTimeSeconds = (Number(series.reading_time) || 0) * 60;
        const testDurationSeconds = Number(series.test_duration) * 60 || 0;
        const totalAllowedSeconds = readingTimeSeconds + testDurationSeconds;

        if (hasAttempt && phase === "reading") {
          const elapsed = (now.getTime() - phaseStartedAt.getTime()) / 1000;

          if (elapsed >= readingTimeSeconds) {
            phase = "answering";

            await strapi.entityService.update("api::answer.answer", marker.id, {
              data: {
                phase: "answering",
                phase_started_at: new Date(
                  phaseStartedAt.getTime() + readingTimeSeconds * 1000
                ),
              },
            });

            phaseStartedAt = new Date(
              phaseStartedAt.getTime() + readingTimeSeconds * 1000
            );
          }
        }

        /* ----------------------------------------
       5. Compute remaining series time
    ---------------------------------------- */
        const elapsedSinceStart = hasAttempt
          ? Math.floor(
              (now.getTime() - new Date(marker.started_at).getTime()) / 1000
            )
          : 0;

        const remainingTime = Math.max(
          totalAllowedSeconds - elapsedSinceStart,
          0
        );

        // 🔥 AUTO-END IF TIME EXPIRED
        if (
          hasAttempt &&
          !attemptCompleted &&
          elapsedSinceStart >= totalAllowedSeconds
        ) {
          await strapi.entityService.update("api::answer.answer", marker.id, {
            data: {
              completed: true,
              phase: "completed",
            },
          });

          attemptCompleted = true;
          phase = "completed";
        }

        if (autoSubmitted) {
          attemptCompleted = true;
          phase = "completed";
        }

        /* ----------------------------------------
       6. Compute paper statuses (attempt-aware)
    ---------------------------------------- */
        const papers = series.papers.map((paper) => {
          if (hasAttempt && phase === "reading") {
            return {
              id: paper.id,
              title: paper.title,
              status: "locked",
              instructions: paper.instruction_booklet,
              question_banks: paper.question_banks || [],
            };
          }

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
       7. Final response
    ---------------------------------------- */
        return {
          data: {
            attempt_id: currentAttemptId,
            total_attempts: totalAttempts, 
            current_attempt_number: totalAttempts,

            phase,
            phase_started_at: phaseStartedAt,
            reading_time: series.reading_time || 0,
            violation: {
              count: violationCount,
              max: maxViolations,
              remaining: Math.max(maxViolations - violationCount, 0),
              auto_submitted: autoSubmitted,
              resume_status: resumeStatus,
            },
            series: {
              id: series.id,
              title: series.title,
              instructions: series.instruction_booklet,
              total_duration: testDurationSeconds,
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

        // Fetch the series first to get reading_time
        const series = await strapi.entityService.findOne(
          "api::test-serie.test-serie",
          seriesId,
          {
            fields: ["reading_time"],
            filters: { publishedAt: { $notNull: true } }, // Only published series
          }
        );

        if (!series) {
          return ctx.notFound("Test series not found");
        }

        // Check for existing attempts
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
            fields: ["attempt_id", "completed", "resume_status"],
          }
        );

        // Prevent starting a new attempt if there's an active one
        if (
          lastAttempt.length > 0 &&
          (!lastAttempt[0].completed ||
            lastAttempt[0].resume_status === "requested")
        ) {
          return ctx.badRequest("An active or pending attempt already exists.");
        }

        const nextAttemptId =
          lastAttempt.length > 0 ? lastAttempt[0].attempt_id + 1 : 1;

        // Determine initial phase
        const readingTimeMinutes = Number(series.reading_time) || 0;
        const initialPhase = readingTimeMinutes > 0 ? "reading" : "answering";

        // Create attempt marker
        const attemptMarker = await strapi.entityService.create(
          "api::answer.answer",
          {
            data: {
              student: user.id,
              test_series: seriesId,
              attempt_id: nextAttemptId,
              completed: false,
              is_attempt_marker: true,
              phase: initialPhase,
              phase_started_at: new Date(),
              started_at: new Date(),
            },
          }
        );

        return {
          data: {
            attempt_id: nextAttemptId,
            phase: initialPhase,
            reading_time: readingTimeMinutes,
          },
        };
      } catch (error) {
        console.error("Error in startNewAttempt:", error);
        ctx.throw(500, error.message);
      }
    },
    async endAttempt(ctx) {
      const { seriesId } = ctx.params;
      const user = ctx.state.user;

      if (!user) {
        return ctx.unauthorized();
      }

      // 1. Find active attempt marker
      const markers = await strapi.entityService.findMany(
        "api::answer.answer",
        {
          filters: {
            student: user.id,
            test_series: seriesId, // ✅ Attempt marker uses series ID
            is_attempt_marker: true,
            completed: false,
          },
          limit: 1,
          fields: ["id", "started_at", "attempt_id"],
        }
      );

      if (!markers.length) {
        return { success: true }; // idempotent
      }

      const marker = markers[0];

      // 2. Fetch series with papers
      const series = await strapi.entityService.findOne(
        "api::test-serie.test-serie",
        seriesId,
        {
          fields: ["reading_time", "test_duration"],
          populate: {
            papers: {
              fields: ["id"], // ✅ Get paper IDs
            },
          },
        }
      );

      const readingTimeSeconds = Number(series.reading_time) * 60 || 0;
      const testDurationSeconds = Number(series.test_duration) * 60 || 0;
      const totalAllowedSeconds = readingTimeSeconds + testDurationSeconds;

      const elapsedSeconds =
        (Date.now() - new Date(marker.started_at).getTime()) / 1000;

      // 3. Get total papers and paper IDs
      const totalPapers = series.papers?.length || 0;
      const paperIds = series.papers?.map((p) => p.id) || [];

      if (totalPapers === 0) {
        console.error("No papers found in series:", seriesId);
        return ctx.badRequest("No papers found in this series");
      }

      // 4. Count submitted paper answers
      // ✅ CRITICAL FIX: Query by paper IDs, not series ID
      const submittedAnswers = await strapi.entityService.findMany(
        "api::answer.answer",
        {
          filters: {
            student: user.id,
            test_series: {
              id: { $in: paperIds }, // ✅ Answer test_series field has paper IDs
            },
            attempt_id: marker.attempt_id,
            completed: true,
            is_attempt_marker: { $ne: true },
          },
          fields: ["id"],
        }
      );

      const allPapersSubmitted = submittedAnswers.length === totalPapers;
      const timeExpired = elapsedSeconds >= totalAllowedSeconds;

      console.log("End attempt check:", {
        totalPapers,
        submittedCount: submittedAnswers.length,
        allPapersSubmitted,
        timeExpired,
      });

      // 5. Allow ending if EITHER all papers submitted OR time expired
      if (!allPapersSubmitted && !timeExpired) {
        return ctx.badRequest(
          "Attempt still active - papers remaining and time left"
        );
      }

      // 6. End attempt
      await strapi.entityService.update("api::answer.answer", marker.id, {
        data: {
          completed: true,
          phase: "completed",
          end_reason: allPapersSubmitted
            ? "all_papers_submitted"
            : "time_expired",
        },
      });

      return {
        success: true,
        end_reason: allPapersSubmitted
          ? "all_papers_submitted"
          : "time_expired",
      };
    },
    async incrementViolation(ctx) {
      try {
        const { seriesId } = ctx.params;
        const user = ctx.state.user;

        if (!user || !seriesId) {
          return ctx.badRequest("Invalid request");
        }

        // 1️⃣ Find active attempt marker
        const markers = await strapi.entityService.findMany(
          "api::answer.answer",
          {
            filters: {
              student: user.id,
              test_series: seriesId,
              is_attempt_marker: true,
            },
            sort: { attempt_id: "desc" },
            limit: 1,
            fields: [
              "id",
              "violation_count",
              "completed",
              "auto_submitted",
              "resume_status",
            ],
          }
        );

        if (!markers.length) {
          return ctx.badRequest("No active attempt found");
        }

        const marker = markers[0];

        // 2️⃣ If already completed → do nothing (idempotent safety)
        if (marker.completed) {
          return {
            data: {
              count: marker.violation_count || 0,
              max: 3,
              remaining: 0,
              auto_submitted: marker.auto_submitted || false,
            },
          };
        }

        const currentCount = marker.violation_count || 0;
        const maxViolations = 3;

        const newCount = currentCount + 1;

        // 3️⃣ If limit reached → auto submit
        if (newCount >= maxViolations) {
          await strapi.entityService.update("api::answer.answer", marker.id, {
            data: {
              violation_count: newCount,
              completed: true,
              auto_submitted: true,
              phase: "completed",
            },
          });

          return {
            data: {
              count: newCount,
              max: maxViolations,
              remaining: 0,
              auto_submitted: true,
              message: "Test auto-submitted due to violations",
            },
          };
        }

        // 4️⃣ Otherwise just increment
        await strapi.entityService.update("api::answer.answer", marker.id, {
          data: {
            violation_count: newCount,
          },
        });

        return {
          data: {
            count: newCount,
            max: maxViolations,
            remaining: maxViolations - newCount,
            auto_submitted: false,
          },
        };
      } catch (error) {
        console.error("Error in incrementViolation:", error);
        ctx.throw(500, error.message);
      }
    },
    async requestResume(ctx) {
      try {
        const { seriesId } = ctx.params;
        const user = ctx.state.user;
        const { reason } = ctx.request.body;

        if (!user || !seriesId) {
          return ctx.badRequest("Invalid request");
        }

        // 1️⃣ Find latest attempt marker
        const markers = await strapi.entityService.findMany(
          "api::answer.answer",
          {
            filters: {
              student: user.id,
              test_series: seriesId,
              is_attempt_marker: true,
            },
            sort: { attempt_id: "desc" },
            limit: 1,
            fields: ["id", "completed", "auto_submitted", "resume_status"],
          }
        );

        if (!markers.length) {
          return ctx.badRequest("No attempt found");
        }

        const marker = markers[0];

        // 2️⃣ Validation Rules

        if (!marker.auto_submitted) {
          return ctx.badRequest(
            "Resume can only be requested for auto-submitted attempts"
          );
        }

        if (!marker.completed) {
          return ctx.badRequest("Attempt is still active");
        }

        if (marker.resume_status && marker.resume_status !== "none") {
          return ctx.badRequest("Resume already requested or processed");
        }

        // 3️⃣ Update marker
        await strapi.entityService.update("api::answer.answer", marker.id, {
          data: {
            resume_status: "requested",
            resume_requested_at: new Date(),
            resume_reason: reason || null,
          },
        });

        return {
          data: {
            success: true,
            resume_status: "requested",
            message: "Resume request submitted to teacher",
          },
        };
      } catch (error) {
        console.error("Error in requestResume:", error);
        ctx.throw(500, error.message);
      }
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

        const paperIds = series.papers.map((p) => p.id);

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
            questions: paper.question_banks.map((q) => ({
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
            question_answers: ans.question_n_answer?.map((qna) => ({
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
    },
  })
);

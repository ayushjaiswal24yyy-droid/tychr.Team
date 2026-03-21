// src/api/test-serie/controllers/pdf.js

module.exports = {
  // ── Offline test paper PDF ─────────────────────────────────────────────────
  async generate(ctx) {
    try {
      const { id } = ctx.params;

      const paper = await strapi.entityService.findOne(
        "api::test-serie.test-serie",
        id,
        {
          populate: {
            question_banks: {
              populate: ["parts", "attachments"],
            },
          },
        }
      );

      if (!paper) return ctx.notFound("Test paper not found");
      if (paper.test_mode !== "offline") {
        return ctx.badRequest("PDF generation is only allowed for offline papers");
      }

      const lambdaUrl = process.env.PDF_LAMBDA_URL;
      const secret = process.env.PDF_SECRET;
      const strapiUrl = process.env.STRAPI_URL || "http://localhost:1337";
      const strapiToken = process.env.STRAPI_API_TOKEN;

      if (!lambdaUrl || !secret || !strapiToken) {
        return ctx.internalServerError("PDF service is not configured");
      }

      const response = await fetch(lambdaUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-pdf-secret": secret,
        },
        body: JSON.stringify({
          type: "paper",
          paper,
          paperId: id,
          strapiUrl,
          strapiToken,
        }),
        signal: AbortSignal.timeout(55000),
      });

      const result = await response.json();

      if (!response.ok) {
        return ctx.internalServerError(result?.error || "PDF generation failed");
      }

      return ctx.send(result);
    } catch (err) {
      strapi.log.error("PDF generate error:", err);
      return ctx.internalServerError(`PDF generation failed: ${err.message}`);
    }
  },

  // ── Question-wise solutions PDF ────────────────────────────────────────────
  async solutions(ctx) {
    try {
      const { id } = ctx.params;

      const series = await strapi.entityService.findOne(
        "api::test-serie.test-serie",
        id,
        {
          populate: {
            papers: {
              populate: {
                question_banks: {
                  parts: {
                    populate: ["correct_answer"], // ✅ IMPORTANT
                  },
                },
              },
            },
            grade_subject: {
              fields: ["id", "name"],
            },
            solution_pdf: true,
          },
        }
      );

      if (!series) return ctx.notFound("Test series not found");

      // Return cached solution PDF if it already exists
      if (series.solution_pdf?.url) {
        return ctx.send({
          success: true,
          cached: true,
          file: {
            id: series.solution_pdf.id,
            url: series.solution_pdf.url,
            name: series.solution_pdf.name,
          },
        });
      }

      const lambdaUrl = process.env.PDF_LAMBDA_URL;
      const secret = process.env.PDF_SECRET;
      const strapiUrl = process.env.STRAPI_URL || "http://localhost:1337";
      const strapiToken = process.env.STRAPI_API_TOKEN;

      if (!lambdaUrl || !secret || !strapiToken) {
        return ctx.internalServerError("PDF service is not configured");
      }
      const allQuestions = (series.papers || []).flatMap(
        (paper) => paper.question_banks || []
      );

      const seriesData = {
        title: series.title,
        grade_subject: series.grade_subject,
        questions: allQuestions.map((q) => ({
          id: q.id,
          question: q.question,
          question_type: q.question_type,
          marks: q.marks,
          parts: (q.parts || []).map((p) => ({
            question_text: p.question_text,
            marks: p.marks,
            answer_type: p.answer_type,
            options: p.options,
            correct_answer: p.correct_answer?.content || p.correct_answer,
          })),
        })),
      };

      const response = await fetch(lambdaUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-pdf-secret": secret,
        },
        body: JSON.stringify({
          type: "solutions",
          seriesData,
          seriesId: id,
          strapiUrl,
          strapiToken,
        }),
        signal: AbortSignal.timeout(55000),
      });

      const result = await response.json();

      if (!response.ok) {
        return ctx.internalServerError(result?.error || "Solutions PDF generation failed");
      }

      return ctx.send(result);
    } catch (err) {
      strapi.log.error("Solutions PDF error:", err);
      return ctx.internalServerError(`Solutions PDF generation failed: ${err.message}`);
    }
  },

  // ── Student result PDF ─────────────────────────────────────────────────────
  async result(ctx) {
    try {
      const { id } = ctx.params;
      const { attempt_id } = ctx.query;

      if (!attempt_id) return ctx.badRequest("attempt_id query param is required");

      const series = await strapi.entityService.findOne(
        "api::test-serie.test-serie",
        id,
        { fields: ["id", "title", "program_type", "test_mode", "test_duration"] }
      );

      if (!series) return ctx.notFound("Test series not found");

  const answers = await strapi.entityService.findMany(
  "api::answer.answer",
  {
    filters: {
      attempt_id: Number(attempt_id),
      completed: true,
      is_attempt_marker: { $ne: true },
    },
    populate: {
      test_series: { fields: ["id", "title", "test_mode"] }, // ← add test_mode
      question_n_answer: {
        populate: {
          question: { populate: ["parts"] },
          part_evaluations: true,
        },
      },
    },
  }
);

// Then filter out offline papers before building the attempt:
const onlineAnswers = answers.filter(
  (ans) => ans.test_series?.test_mode !== "offline"
);


      if (!onlineAnswers?.length) return ctx.notFound("No answers found for this attempt");

      const submissionDate = onlineAnswers
        .map((a) => new Date(a.submission_date))
        .sort((a, b) => b - a)[0];

      const totalMarks = onlineAnswers.reduce((sum, a) => sum + (a.marks || 0), 0);
      const allQuestions = onlineAnswers.flatMap(
        (ans) => (ans.question_n_answer || []).map((qna) => ({
          id: qna.question?.id,
          marks: qna.question?.marks || 0,
        }))
      );



      const attempt = {
        attempt_no: 1,
        attempt_id: Number(attempt_id),
        submission_date: submissionDate,
        total_marks: totalMarks,
        evaluation_status: onlineAnswers.every((a) => a.evaluation_status === "evaluated")
          ? "evaluated"
          : "pending",
        questions: allQuestions,
        papers: onlineAnswers.map((ans) => ({
          id: ans.id,
          paper_id: ans.test_series?.id,
          paper_title: ans.test_series?.title,
          marks: ans.marks,
          time_taken: ans.time_taken,
          question_answers: (ans.question_n_answer || []).map((qna) => {
            const parseRichtext = (val) => {
              if (!val) return "";
              try {
                const parsed = typeof val === "string" ? JSON.parse(val) : val;
                return parsed?.content || val;
              } catch {
                return val;
              }
            };

            const parseStudentAnswer = (answer) => {
  if (!answer) return null;
  try {
    const parsed = typeof answer === "string" ? JSON.parse(answer) : answer;
    if (typeof parsed !== "object" || parsed === null) {
      return typeof answer === "string" ? answer : null;
    }

    // Canvas JSON — has "objects" key with fabric.js shapes
    if (parsed.objects) {
      return "__CANVAS__"; // signal to skip rendering
    }

    // Fill in the blanks / match columns — numeric keys + part_0
    // e.g. {"1": "are", "2": "doing", "part_0": ""}
    const entries = Object.entries(parsed);
    const partEntries = entries.filter(([k]) => k.startsWith("part_"));
    const blankEntries = entries.filter(([k]) => !k.startsWith("part_") && k !== "format" && k !== "content" && k !== "_v");

    // Richtext wrapper: {"format":"richtext","content":"...","_v":"1.0"}
    if (parsed.format && parsed.content !== undefined) {
      return parsed.content || null;
    }

    // Fill in the blanks: numeric keys like {"1":"are","2":"doing"}
    if (blankEntries.length > 0) {
      return blankEntries
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([k, v]) => "Blank " + k + ": <strong>" + (v || "—") + "</strong>")
        .join("<br/>");
    }

    // Part map: {"part_0": "<p>...</p>"}
    if (partEntries.length > 0) {
      return partEntries
        .map(([, v]) => (typeof v === "string" ? v : JSON.stringify(v)))
        .join("<br/>");
    }

    return null;
  } catch {
    return typeof answer === "string" ? answer : null;
  }
};

            return {
              question_id: qna.question?.id,
              question: parseRichtext(qna.question?.question),  
              parts: qna.question?.parts || [],
              question_type: qna.question?.question_type,
              marks: qna.question?.marks,
              student_answer: parseStudentAnswer(qna.answer),  
              part_evaluations: (qna.part_evaluations || []).map((pe) => ({
                part_index: pe.part_index,
                awarded_marks: pe.awarded_marks,
                feedback: pe.feedback,
              })),
              awarded_marks: qna.question_awarded_marks ?? 0,
              feedback: qna.question_feedback,
            };
          }),
        })),
      };

      const user = ctx.state.user;
      const student = {
        fullName: user?.fullName || user?.username,
        email: user?.email,
        schoolname: user?.schoolname,
      };

      const lambdaUrl = process.env.PDF_LAMBDA_URL;
      const secret = process.env.PDF_SECRET;
      const strapiUrl = process.env.STRAPI_URL || "http://localhost:1337";
      const strapiToken = process.env.STRAPI_API_TOKEN;

      if (!lambdaUrl || !secret || !strapiToken) {
        return ctx.internalServerError("PDF service is not configured");
      }

      const response = await fetch(lambdaUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-pdf-secret": secret,
        },
        body: JSON.stringify({
          type: "result",
          student,
          series: {
            title: series.title,
            program_type: series.program_type,
          },
          attempt,
          strapiUrl,
          strapiToken,
        }),
        signal: AbortSignal.timeout(55000),
      });

      const result = await response.json();

      if (!response.ok) {
        return ctx.internalServerError(result?.error || "Result PDF generation failed");
      }

      return ctx.send(result);
    } catch (err) {
      strapi.log.error("Result PDF error:", err);
      return ctx.internalServerError(`Result PDF generation failed: ${err.message}`);
    }
  },
};
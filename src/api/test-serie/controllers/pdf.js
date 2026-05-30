// src/api/test-serie/controllers/pdf.js

// ---------------------------------------------------------------------------
// Helpers — parse Strapi richtext and student answer formats
// ---------------------------------------------------------------------------

const parseRichtext = (val) => {
  if (!val) return "";
  try {
    const parsed = typeof val === "string" ? JSON.parse(val) : val;
    if (parsed && typeof parsed === "object" && parsed.content !== undefined) {
      return parsed.content || "";
    }
    return typeof val === "string" ? val : "";
  } catch {
    return typeof val === "string" ? val : "";
  }
};

const parseStudentAnswer = (answer) => {
  if (answer === null || answer === undefined) return null;
  try {
    const parsed = typeof answer === "string" ? JSON.parse(answer) : answer;

    if (typeof parsed !== "object" || parsed === null) {
      return typeof answer === "string" ? answer : null;
    }

    // Canvas JSON
    if (parsed.objects !== undefined) return "__CANVAS__";

    // Richtext wrapper: {"format":"richtext","content":"...","_v":"1.0"}
    if (parsed.format !== undefined && parsed.content !== undefined) {
      return parsed.content || null;
    }

    const entries = Object.entries(parsed);

    // Numeric keys = fill in the blanks slots e.g. {"1":"are","2":"doing"}
    const blankEntries = entries.filter(([k]) => /^\d+$/.test(k));
    if (blankEntries.length > 0) {
      return blankEntries
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([k, v]) => "Blank " + k + ": <strong>" + (v || "—") + "</strong>")
        .join("<br/>");
    }

    // Part map: {"part_0": "..."} — for single-part questions
    const partEntries = entries.filter(([k]) => k.startsWith("part_"));
    if (partEntries.length > 0) {
      const values = partEntries
        .map(([, v]) => {
          if (!v) return null;
          // Try to unwrap richtext wrapper inside the part value
          try {
            const inner = typeof v === "string" ? JSON.parse(v) : v;
            if (inner && typeof inner === "object" && inner.content !== undefined) {
              return inner.content || null;
            }
          } catch { /* not JSON */ }
          return typeof v === "string" ? v : JSON.stringify(v);
        })
        .filter(Boolean);
      return values.length > 0 ? values.join("<br/>") : null;
    }

    return null;
  } catch {
    return typeof answer === "string" ? answer : null;
  }
};

// For multi-part questions: extract the answer for a specific part index
const parsePartAnswer = (answer, partIndex) => {
  if (!answer) return null;
  try {
    const parsed = typeof answer === "string" ? JSON.parse(answer) : answer;
    if (typeof parsed !== "object" || parsed === null) return null;
    if (parsed.objects !== undefined) return "__CANVAS__";

    const partKey = "part_" + partIndex;
    const val = parsed[partKey];
    if (val === undefined || val === null || val === "") return null;

    // Unwrap richtext wrapper
    try {
      const inner = typeof val === "string" ? JSON.parse(val) : val;
      if (inner && typeof inner === "object" && inner.content !== undefined) {
        return inner.content || null;
      }
    } catch { /* not JSON */ }

    return typeof val === "string" ? val : JSON.stringify(val);
  } catch {
    return null;
  }
};

const isAdminUser = (user) => {
  const roleType = user?.role?.type;
  const roleName = user?.role?.name;
  return roleType === "admin" || roleName === "Admin" || roleName === "admin";
};

const getPaperIdsForSeries = (series, id) => {
  if (series.entity_type === "paper") return [Number(id)];
  const paperIds = (series.papers || []).map((paper) => paper.id);
  // fallback: treat the series itself as a paper if no child papers found
  return paperIds.length ? paperIds : [Number(id)];
};

const getPaperRowsForSeries = (series) => {
  if (series.entity_type === "paper") return [series];
  const papers = series.papers || [];
  return papers.length ? papers : [series];
};

const isPaperEnded = (paper, now = new Date()) => {
  if (!paper.start_date) return true;

  const start = new Date(paper.start_date);
  const durationMinutes = Number(paper.test_duration || 0);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

  return end <= now;
};

const getResultPdfConfig = () => {
  const lambdaUrl = process.env.PDF_LAMBDA_URL;
  const secret = process.env.PDF_SECRET;
  const strapiUrl = process.env.STRAPI_URL || "http://localhost:1337";
  const strapiToken = process.env.STRAPI_API_TOKEN;

  return { lambdaUrl, secret, strapiUrl, strapiToken };
};

const buildResultPdfPayload = ({ series, answers, attemptId, fallbackUser }) => {
  const onlineAnswers = answers.filter(
    (ans) => ans.test_series?.test_mode !== "offline"
  );

  if (!onlineAnswers.length) return null;

  const answerStudent = onlineAnswers[0]?.student || null;
  if (!answerStudent?.id) return null;

  const totalMarks = onlineAnswers.reduce((sum, a) => sum + (a.marks || 0), 0);
  const submissionDate = onlineAnswers
    .map((a) => new Date(a.submission_date))
    .sort((a, b) => b - a)[0];

  const attempt = {
    attempt_no: 1,
    attempt_id: Number(attemptId),
    submission_date: submissionDate,
    total_marks: totalMarks,
    evaluation_status: onlineAnswers.every((a) => a.evaluation_status === "evaluated")
      ? "evaluated"
      : "pending",
    papers: onlineAnswers.map((ans) => ({
      id: ans.id,
      paper_id: ans.test_series?.id,
      paper_title: ans.test_series?.title,
      marks: ans.marks,
      time_taken: ans.time_taken,
      question_answers: (ans.question_n_answer || []).map((qna) => {
        const parts = qna.question?.parts || [];
        const isSinglePart = parts.length <= 1;

        return {
          question_id: qna.question?.id,
          question: parseRichtext(qna.question?.question),
          parts: parts.map((p) => ({
            question_text: parseRichtext(p.question_text),
            marks: p.marks,
            answer_type: p.answer_type,
          })),
          question_type: qna.question?.question_type,
          marks: qna.question?.marks,
          student_answer: isSinglePart ? parseStudentAnswer(qna.answer) : null,
          part_student_answers: isSinglePart
            ? null
            : parts.map((_, pi) => parsePartAnswer(qna.answer, pi)),
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

  const student = {
    id: answerStudent.id,
    fullName:
      answerStudent?.fullName ||
      answerStudent?.username ||
      fallbackUser?.fullName ||
      fallbackUser?.username,
    email: answerStudent?.email || fallbackUser?.email,
    schoolname: answerStudent?.schoolname || fallbackUser?.schoolname,
  };

  return {
    type: "result",
    student,
    series: { title: series.title, program_type: series.program_type },
    attempt,
  };
};

const postResultPdfToLambda = async ({ payload, config }) => {
  const response = await fetch(config.lambdaUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-pdf-secret": config.secret },
    body: JSON.stringify({
      ...payload,
      strapiUrl: config.strapiUrl,
      strapiToken: config.strapiToken,
    }),
    signal: AbortSignal.timeout(55000),
  });

  const text = await response.text();
  let result;
  try { result = JSON.parse(text); } catch {
    throw new Error("Lambda error: " + text.substring(0, 200));
  }

  if (!response.ok) {
    throw new Error(result?.error || "Result PDF failed");
  }

  return result;
};

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

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
      const cleanedPaper = {
        ...paper,
        question_banks: (paper.question_banks || []).map((q) => ({
          ...q,
          question: parseRichtext(q.question), // ✅ FIX
          parts: (q.parts || []).map((p) => ({
            ...p,
            question_text: parseRichtext(p.question_text), // ✅ FIX
          })),
        })),
      };

      const response = await fetch(lambdaUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-pdf-secret": secret },
        body: JSON.stringify({
          type: "paper",
          paper: cleanedPaper, // ✅ USE CLEANED DATA
          paperId: id,
          strapiUrl,
          strapiToken,
        }),
      });

      const text = await response.text();
      let result;
      try { result = JSON.parse(text); } catch {
        strapi.log.error("Lambda non-JSON:", text);
        return ctx.internalServerError("Lambda error: " + text.substring(0, 200));
      }

      if (!response.ok) return ctx.internalServerError(result?.error || "PDF generation failed");
      return ctx.send(result);
    } catch (err) {
      strapi.log.error("PDF generate error:", err);
      return ctx.internalServerError("PDF generation failed: " + err.message);
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
              populate: { question_banks: { populate: ["parts"] } },
            },
            grade_subject: { fields: ["id", "name"] },
            solution_pdf: true,
          },
        }
      );

      if (!series) return ctx.notFound("Test series not found");

      if (series.solution_pdf?.url) {
        return ctx.send({
          success: true,
          cached: true,
          file: { id: series.solution_pdf.id, url: series.solution_pdf.url, name: series.solution_pdf.name },
        });
      }

      const lambdaUrl = process.env.PDF_LAMBDA_URL;
      const secret = process.env.PDF_SECRET;
      const strapiUrl = process.env.STRAPI_URL || "http://localhost:1337";
      const strapiToken = process.env.STRAPI_API_TOKEN;

      if (!lambdaUrl || !secret || !strapiToken) {
        return ctx.internalServerError("PDF service is not configured");
      }

      const allQuestions = (series.papers || []).flatMap((p) => p.question_banks || []);

      const seriesData = {
        title: series.title,
        grade_subject: series.grade_subject,
        questions: allQuestions.map((q) => ({
          id: q.id,
          question: parseRichtext(q.question), // ✅ FIXED
          question_type: q.question_type,
          marks: q.marks,
          parts: (q.parts || []).map((p) => ({
            question_text: parseRichtext(p.question_text), // ✅ FIXED
            marks: p.marks,
            answer_type: p.answer_type,
            options: p.options,
            correct_answer: p.correct_answer,
          })),
        })),
      };

      const response = await fetch(lambdaUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-pdf-secret": secret },
        body: JSON.stringify({ type: "solutions", seriesData, seriesId: id, strapiUrl, strapiToken }),
        signal: AbortSignal.timeout(55000),
      });

      const text = await response.text();
      let result;
      try { result = JSON.parse(text); } catch {
        return ctx.internalServerError("Lambda error: " + text.substring(0, 200));
      }

      if (!response.ok) return ctx.internalServerError(result?.error || "Solutions PDF failed");
      return ctx.send(result);
    } catch (err) {
      strapi.log.error("Solutions PDF error:", err);
      return ctx.internalServerError("Solutions PDF failed: " + err.message);
    }
  },

  // ── Student result PDF ─────────────────────────────────────────────────────
  async result(ctx) {
    try {
      const { id } = ctx.params;
      const { attempt_id } = ctx.query;

      if (!attempt_id) return ctx.badRequest("attempt_id query param is required");
      const user = ctx.state.user;
      if (!user) return ctx.unauthorized("You must be logged in to download results PDF");

      const series = await strapi.entityService.findOne(
        "api::test-serie.test-serie",
        id,
        {
          fields: ["id", "title", "program_type", "test_mode", "test_duration", "entity_type"],
          populate: { papers: { fields: ["id"] } },
        }
      );

      const paperIds = series.entity_type === "paper"
        ? [Number(id)]
        : (series.papers || []).map((p) => p.id);

      if (!paperIds.length) return ctx.badRequest("No papers found for this series")
      if (!series) return ctx.notFound("Test series not found");

      const answers = await strapi.entityService.findMany("api::answer.answer", {
        filters: {
          attempt_id: Number(attempt_id),
          completed: true,
          is_attempt_marker: { $ne: true },
          test_series: { id: { $in: paperIds } },
        },
        populate: {
          student: { fields: ["id", "fullName", "username", "email", "schoolname"] },
          test_series: { fields: ["id", "title", "test_mode"] },
          question_n_answer: {
            populate: {
              question: { populate: ["parts"] },
              part_evaluations: true,
            },
          },
        },
      });

      if (!answers?.length) return ctx.notFound("No answers found for this attempt");

      const answerStudent = answers[0]?.student || null;
      const answerStudentId = answerStudent?.id || null;
      if (!answerStudentId) {
        return ctx.internalServerError("Answer student not found");
      }

      const mixedStudents = answers.some((ans) => ans.student?.id !== answerStudentId);
      if (mixedStudents) {
        return ctx.badRequest("Attempt contains multiple students");
      }

      if (user.id !== answerStudentId) {
        const tutorEnrollments = await strapi.entityService.findMany(
          "api::enrollment.enrollment",
          {
            filters: {
              $or: [
                { tutor: { id: { $eq: user.id } } },
                { assistant: { id: { $eq: user.id } } },
              ],
              students: { id: { $eq: answerStudentId } },
            },
            fields: ["id"],
            pagination: { limit: -1 },
          }
        );

        if (tutorEnrollments.length === 0) {
          strapi.log.info("tutor_results_auth_denied", {
            reason: "no_shared_classroom",
            userId: user.id,
            studentId: answerStudentId,
            seriesId: id,
            attemptId: Number(attempt_id),
          });
          return ctx.forbidden("You are not authorized to view this student.");
        }
      }

      // Only include online papers in the result PDF
      const onlineAnswers = answers.filter(
        (ans) => ans.test_series?.test_mode !== "offline"
      );

      if (!onlineAnswers.length) {
        return ctx.badRequest("No online paper answers found for this attempt");
      }
      const totalMarks = onlineAnswers.reduce((sum, a) => sum + (a.marks || 0), 0);
      const submissionDate = onlineAnswers
        .map((a) => new Date(a.submission_date))
        .sort((a, b) => b - a)[0];

      const attempt = {
        attempt_no: 1,
        attempt_id: Number(attempt_id),
        submission_date: submissionDate,
        total_marks: totalMarks,
        evaluation_status: onlineAnswers.every((a) => a.evaluation_status === "evaluated")
          ? "evaluated"
          : "pending",
        papers: onlineAnswers.map((ans) => ({
          id: ans.id,
          paper_id: ans.test_series?.id,
          paper_title: ans.test_series?.title,
          marks: ans.marks,
          time_taken: ans.time_taken,
          question_answers: (ans.question_n_answer || []).map((qna) => {
            const parts = qna.question?.parts || [];
            const isSinglePart = parts.length <= 1;

            return {
              question_id: qna.question?.id,
              question: parseRichtext(qna.question?.question),
              parts: parts.map((p) => ({
                question_text: parseRichtext(p.question_text),
                marks: p.marks,
                answer_type: p.answer_type,
              })),
              question_type: qna.question?.question_type,
              marks: qna.question?.marks,
              // Single-part: parse the full answer now
              // Multi-part: parse per-part answers into an array
              student_answer: isSinglePart
                ? parseStudentAnswer(qna.answer)
                : null,
              part_student_answers: isSinglePart
                ? null
                : parts.map((_, pi) => parsePartAnswer(qna.answer, pi)),
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

      const student = {
        fullName:
          answerStudent?.fullName ||
          answerStudent?.username ||
          user?.fullName ||
          user?.username,
        email: answerStudent?.email || user?.email,
        schoolname: answerStudent?.schoolname || user?.schoolname,
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
        headers: { "Content-Type": "application/json", "x-pdf-secret": secret },
        body: JSON.stringify({
          type: "result",
          student,
          series: { title: series.title, program_type: series.program_type },
          attempt,
          strapiUrl,
          strapiToken,
        }),
        signal: AbortSignal.timeout(55000),
      });

      const text = await response.text();
      let result;
      try { result = JSON.parse(text); } catch {
        return ctx.internalServerError("Lambda error: " + text.substring(0, 200));
      }

      if (!response.ok) return ctx.internalServerError(result?.error || "Result PDF failed");
      return ctx.send(result);
    } catch (err) {
      strapi.log.error("Result PDF error:", err);
      return ctx.internalServerError("Result PDF failed: " + err.message);
    }
  },

  async exportResultsBatch(ctx) {
    try {
      const { id } = ctx.params;
      const { classroomId } = ctx.query;
      const user = ctx.state.user;

      if (!user) return ctx.unauthorized("You must be logged in to export result PDFs");
      if (!isAdminUser(user)) {
        return ctx.forbidden("Only admin users can export batch result PDFs");
      }

      const config = getResultPdfConfig();
      if (!config.lambdaUrl || !config.secret || !config.strapiToken) {
        return ctx.internalServerError("PDF service is not configured");
      }

      const series = await strapi.entityService.findOne(
        "api::test-serie.test-serie",
        id,
        {
          fields: [
            "id",
            "title",
            "program_type",
            "test_mode",
            "test_duration",
            "entity_type",
            "start_date",
          ],
          populate: {
            papers: {
              fields: ["id", "title", "test_mode", "test_duration", "start_date"],
            },
          },
        }
      );

      if (!series) return ctx.notFound("Test series not found");

      strapi.log.info(`[exportResultsBatch] id=${id} entity_type=${series.entity_type} papers=${JSON.stringify((series.papers||[]).map(p=>p.id))}`);

      const paperIds = getPaperIdsForSeries(series, id);
      if (!paperIds.length) return ctx.badRequest("No papers found for this series");

      const paperRows = getPaperRowsForSeries(series);
      const notEnded = paperRows.filter((paper) => !isPaperEnded(paper));
      if (notEnded.length) {
        return ctx.badRequest("Result PDFs can be exported only after the test has ended");
      }

      const answerFilters = {
        completed: true,
        is_attempt_marker: { $ne: true },
        evaluation_status: "evaluated",
        attempt_id: { $notNull: true },
        test_series: { id: { $in: paperIds } },
      };

      if (classroomId) {
        answerFilters.tutor_classroom = { id: { $eq: classroomId } };
      }

      const answers = await strapi.entityService.findMany("api::answer.answer", {
        filters: answerFilters,
        fields: [
          "id",
          "marks",
          "submission_date",
          "time_taken",
          "attempt_id",
          "evaluation_status",
        ],
        populate: {
          student: { fields: ["id", "fullName", "username", "email", "schoolname"] },
          test_series: { fields: ["id", "title", "test_mode"] },
          question_n_answer: {
            populate: {
              question: { populate: ["parts"] },
              part_evaluations: true,
            },
          },
        },
        pagination: { limit: -1 },
      });

      if (!answers.length) {
        return ctx.notFound("No evaluated student results found for this test");
      }

      const grouped = new Map();
      for (const answer of answers) {
        const studentId = answer.student?.id;
        const attemptId = answer.attempt_id;
        if (!studentId || !attemptId) continue;

        const key = `${studentId}:${attemptId}`;
        if (!grouped.has(key)) {
          grouped.set(key, {
            studentId,
            attemptId,
            student: answer.student,
            answers: [],
          });
        }

        grouped.get(key).answers.push(answer);
      }

      const exports = [];
      const failures = [];
      const bestGroupByStudent = new Map();

      for (const group of grouped.values()) {
        const totalMarks = group.answers.reduce(
          (sum, answer) => sum + Number(answer.marks || 0),
          0
        );
        const latestSubmission = group.answers
          .map((answer) => new Date(answer.submission_date || 0))
          .sort((a, b) => b - a)[0];
        const current = bestGroupByStudent.get(group.studentId);

        if (
          !current ||
          totalMarks > current.totalMarks ||
          (totalMarks === current.totalMarks && latestSubmission > current.latestSubmission)
        ) {
          bestGroupByStudent.set(group.studentId, {
            ...group,
            totalMarks,
            latestSubmission,
          });
        }
      }

      for (const group of bestGroupByStudent.values()) {
        try {
          const payload = buildResultPdfPayload({
            series,
            answers: group.answers,
            attemptId: group.attemptId,
            fallbackUser: user,
          });

          if (!payload) {
            failures.push({
              studentId: group.studentId,
              attemptId: group.attemptId,
              error: "No online evaluated answers found",
            });
            continue;
          }

          const result = await postResultPdfToLambda({ payload, config });
          exports.push({
            studentId: group.studentId,
            studentName: payload.student.fullName,
            studentEmail: payload.student.email,
            attemptId: group.attemptId,
            file: result.file || result,
          });
        } catch (error) {
          failures.push({
            studentId: group.studentId,
            attemptId: group.attemptId,
            error: error.message,
          });
        }
      }

      return ctx.send({
        success: true,
        series: {
          id: series.id,
          title: series.title,
          totalPapers: paperIds.length,
        },
        summary: {
          totalAttempts: grouped.size,
          totalStudents: bestGroupByStudent.size,
          exported: exports.length,
          failed: failures.length,
        },
        exports,
        failures,
      });
    } catch (err) {
      strapi.log.error("Batch result PDF export error:", err);
      return ctx.internalServerError("Batch result PDF export failed: " + err.message);
    }
  },
};

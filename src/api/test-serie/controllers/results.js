'use strict';

/**
 * Custom controller for Test Series Results
 * Route: GET /api/test-series/:id/results
 * Query params:
 *   - classroomId (optional) — filter stats to a specific enrollment/classroom
 *
 * Returns aggregated results for a parent test series and all its papers,
 * including the logged-in student's scores, global (or classroom-scoped) stats,
 * rank, and percentile.
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::test-serie.test-serie', ({ strapi }) => ({

  async results(ctx) {
    const { id } = ctx.params;
    const { classroomId } = ctx.query;
    const studentId = ctx.state.user?.id;

    if (!studentId) {
      return ctx.unauthorized('You must be logged in to view results.');
    }

    // ── 1. Fetch the parent test series ──────────────────────────────────────
    const series = await strapi.entityService.findOne(
      'api::test-serie.test-serie',
      id,
      {
        populate: {
          papers: {
            fields: ['id', 'title', 'entity_type', 'start_date', 'test_duration', 'pass_mark'],
          },
          grade_subject: { fields: ['id', 'name'] },
        },
      }
    );

    if (!series) {
      return ctx.notFound('Test series not found.');
    }

    if (series.entity_type !== 'series') {
      return ctx.badRequest('Provided ID is not a parent test series.');
    }

    const paperIds = (series.papers || []).map((p) => p.id);

    if (paperIds.length === 0) {
      return ctx.send({
        series: {
          id: series.id,
          title: series.title,
          program_type: series.program_type,
          grade_subject: series.grade_subject,
        },
        stats: null,
        papers: [],
        chart: [],
        table: [],
      });
    }

    // ── 2. Build base filters for "all completed answers" ────────────────────
    // We only consider is_attempt_marker = false (actual submissions) that are completed.
    const baseAnswerFilter = {
      test_series: { id: { $in: paperIds } },
      completed: { $eq: true },
      is_attempt_marker: { $eq: false },
      evaluation_status: { $eq: 'evaluated' },
    };

    // Optionally scope to a classroom
    if (classroomId) {
      baseAnswerFilter.tutor_classroom = { id: { $eq: classroomId } };
    }

    // ── 3. Fetch ALL evaluated answers for these papers ──────────────────────
    const allAnswers = await strapi.entityService.findMany('api::answer.answer', {
      filters: baseAnswerFilter,
      fields: ['id', 'marks', 'submission_date', 'time_taken'],
      populate: {
        student: { fields: ['id'] },
        test_series: { fields: ['id', 'title', 'pass_mark'] },
      },
      pagination: { limit: -1 },
    });

    // ── 4. Fetch the logged-in student's own answers ─────────────────────────
    const myAnswers = allAnswers.filter((a) => a.student?.id === studentId);

    // ── 5. Aggregate per-paper stats ─────────────────────────────────────────
    // Group all answers by paper id
    const byPaper = {};
    for (const paperId of paperIds) {
      byPaper[paperId] = { all: [], mine: null };
    }

    for (const answer of allAnswers) {
      const pid = answer.test_series?.id;
      if (pid && byPaper[pid]) {
        byPaper[pid].all.push(answer.marks ?? 0);
        if (answer.student?.id === studentId) {
          // Keep the latest attempt
          if (
            !byPaper[pid].mine ||
            new Date(answer.submission_date) > new Date(byPaper[pid].mine.submission_date)
          ) {
            byPaper[pid].mine = answer;
          }
        }
      }
    }

    // ── 6. Build per-paper result objects ────────────────────────────────────
    const paperResults = series.papers.map((paper) => {
      const data = byPaper[paper.id] || { all: [], mine: null };
      const allMarks = data.all;
      const myAnswer = data.mine;

      const highestScore = allMarks.length ? Math.max(...allMarks) : null;
      const meanScore =
        allMarks.length
          ? parseFloat((allMarks.reduce((s, m) => s + m, 0) / allMarks.length).toFixed(2))
          : null;
      const sortedMarks = [...allMarks].sort((a, b) => a - b);
      const medianScore =
        sortedMarks.length
          ? sortedMarks.length % 2 === 0
            ? (sortedMarks[sortedMarks.length / 2 - 1] + sortedMarks[sortedMarks.length / 2]) / 2
            : sortedMarks[Math.floor(sortedMarks.length / 2)]
          : null;

      const myScore = myAnswer?.marks ?? null;
      const totalStudents = new Set(
        (byPaper[paper.id]?.all ? allAnswers.filter((a) => a.test_series?.id === paper.id) : []).map(
          (a) => a.student?.id
        )
      ).size;

      // Rank: how many students scored strictly higher than me?
      let rank = null;
      let percentile = null;
      if (myScore !== null && allMarks.length) {
        const uniqueStudentScores = {};
        allAnswers
          .filter((a) => a.test_series?.id === paper.id)
          .forEach((a) => {
            const sid = a.student?.id;
            const m = a.marks ?? 0;
            if (!uniqueStudentScores[sid] || m > uniqueStudentScores[sid]) {
              uniqueStudentScores[sid] = m;
            }
          });

        const scores = Object.values(uniqueStudentScores);
        const scoredHigher = scores.filter((s) => s > myScore).length;
        rank = scoredHigher + 1;
        percentile = parseFloat(
          (((scores.length - rank) / scores.length) * 100).toFixed(1)
        );
      }

      const passed =
        paper.pass_mark !== null && myScore !== null ? myScore >= paper.pass_mark : null;

      return {
        id: paper.id,
        title: paper.title,
        start_date: paper.start_date,
        test_duration: paper.test_duration,
        pass_mark: paper.pass_mark,
        totalStudents,
        myScore,
        highestScore,
        meanScore,
        medianScore,
        rank,
        percentile,
        passed,
        submissionDate: myAnswer?.submission_date ?? null,
        timeTaken: myAnswer?.time_taken ?? null,
        attempted: myAnswer !== null,
      };
    });

    // ── 7. Series-level aggregate stats ─────────────────────────────────────
    const attemptedPapers = paperResults.filter((p) => p.attempted);
    const seriesMyTotal = attemptedPapers.reduce((s, p) => s + (p.myScore ?? 0), 0);
    const seriesHighest = paperResults.reduce((s, p) => s + (p.highestScore ?? 0), 0);
    const seriesMean = paperResults.reduce((s, p) => s + (p.meanScore ?? 0), 0);
    const seriesMedian = paperResults.reduce((s, p) => s + (p.medianScore ?? 0), 0);

    // Global rank: sum of myScores vs all students who attempted all/any papers
    const allStudentTotals = {};
    for (const answer of allAnswers) {
      const sid = answer.student?.id;
      if (!sid) continue;
      allStudentTotals[sid] = (allStudentTotals[sid] ?? 0) + (answer.marks ?? 0);
    }
    const totalScores = Object.values(allStudentTotals);
    const myTotal = allStudentTotals[studentId] ?? 0;
    const globalRank = totalScores.filter((s) => s > myTotal).length + 1;
    const globalPercentile =
      totalScores.length > 0
        ? parseFloat((((totalScores.length - globalRank) / totalScores.length) * 100).toFixed(1))
        : null;

    // ── 8. Chart data ────────────────────────────────────────────────────────
    const chart = paperResults.map((p) => ({
      paperId: p.id,
      paperTitle: p.title,
      highestScore: p.highestScore,
      myScore: p.myScore,
      meanScore: p.meanScore,
    }));

    // ── 9. Table data (sorted by paper order / start_date) ───────────────────
    const table = paperResults
      .filter((p) => p.attempted)
      .map((p, idx) => ({
        sno: idx + 1,
        paperId: p.id,
        paperTitle: p.title,
        rank: p.rank,
        percentile: p.percentile,
        myScore: p.myScore,
        highestScore: p.highestScore,
        meanScore: p.meanScore,
        passed: p.passed,
        submissionDate: p.submissionDate,
        timeTaken: p.timeTaken,
      }));

    return ctx.send({
      series: {
        id: series.id,
        title: series.title,
        program_type: series.program_type,
        grade_subject: series.grade_subject,
        totalPapers: paperIds.length,
        attemptedPapers: attemptedPapers.length,
      },
      stats: {
        myTotal: seriesMyTotal,
        highestTotal: seriesHighest,
        meanTotal: parseFloat(seriesMean.toFixed(2)),
        medianTotal: parseFloat(seriesMedian.toFixed(2)),
        globalRank,
        globalPercentile,
        totalStudents: Object.keys(allStudentTotals).length,
        scopedToClassroom: classroomId ? true : false,
      },
      papers: paperResults,
      chart,
      table,
    });
  },
}));
'use strict';

/**
 * Custom controller for Test Series Results
 * Route: GET /api/test-series/:id/results
 * Query params:
 *   - classroomId (optional) — filter stats to a specific enrollment/classroom
 *
 * fullMarks per paper = sum of question_bank.marks for all question banks
 * linked to that paper (marks already includes parts totals per schema).
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::test-serie.test-serie', ({ strapi }) => ({

  async results(ctx) {
    const { id } = ctx.params;
    const { classroomId } = ctx.query;
    const studentId = ctx.state.user?.id;

    if (!studentId) return ctx.unauthorized('You must be logged in to view results.');

    // ── 1. Fetch series ──────────────────────────────────────────────────────
    const series = await strapi.entityService.findOne(
      'api::test-serie.test-serie',
      id,
      {
        populate: {
          papers: {
            fields: ['id', 'title', 'entity_type', 'start_date', 'test_duration', 'pass_mark'],
            populate: {
              question_banks: {
                fields: ['id', 'marks'],
                populate: {
                  unit: { fields: ['id', 'name'] },  // ← ADD THIS
                },
              },
            },
          },
          grade_subject: { fields: ['id', 'name'] },
        },
      }
    );

    if (!series) return ctx.notFound('Test series not found.');
    if (series.entity_type !== 'series') return ctx.badRequest('Provided ID is not a parent test series.');

    const paperIds = (series.papers || []).map((p) => p.id);
    if (paperIds.length === 0) {
      return ctx.send({ series: { id: series.id, title: series.title }, stats: null, papers: [], chart: [], table: [], unitAnalysis: [] });
    }

    // ── 2. Base filter ───────────────────────────────────────────────────────
    const baseAnswerFilter = {
      test_series: { id: { $in: paperIds } },
      completed: { $eq: true },
      is_attempt_marker: { $eq: false },
      evaluation_status: { $eq: 'evaluated' },
    };
    if (classroomId) baseAnswerFilter.tutor_classroom = { id: { $eq: classroomId } };

    // ── 3. Fetch all evaluated answers ──────────────────────────────────────
    // ── 3. Fetch all evaluated answers (updated populate) ───────────────────
    const allAnswers = await strapi.entityService.findMany('api::answer.answer', {
      filters: baseAnswerFilter,
      fields: ['id', 'marks', 'submission_date', 'time_taken'],
      populate: {
        student: { fields: ['id'] },
        test_series: { fields: ['id', 'title', 'pass_mark'] },
        question_n_answer: {
          populate: {
            question: {
              fields: ['id'],
              populate: {
                unit: { fields: ['id', 'name'] },
              },
            },
            // part_evaluations if you need per-part marks later
          },
        },
      },
      pagination: { limit: -1 },
    });
    // After fetching allAnswers, build a deduplicated map:
    // bestAttempt[paperId][studentId] = the answer with highest marks (or latest if tied)
    const bestAttempt = {};   // paperId → { [studentId]: answer }
    const allAttemptsByStudent = {};  // studentId → paperId → answer[] (for progression)

    for (const answer of allAnswers) {
      const pid = answer.test_series?.id;
      const sid = answer.student?.id;
      if (!pid || !sid) continue;

      // Track ALL attempts per student per paper (for progression feature)
      if (!allAttemptsByStudent[sid]) allAttemptsByStudent[sid] = {};
      if (!allAttemptsByStudent[sid][pid]) allAttemptsByStudent[sid][pid] = [];
      allAttemptsByStudent[sid][pid].push(answer);

      // Keep best attempt (highest marks, latest on tie)
      if (!bestAttempt[pid]) bestAttempt[pid] = {};
      const current = bestAttempt[pid][sid];
      const currentMarks = current?.marks ?? -Infinity;
      const newMarks = answer.marks ?? 0;
      if (
        newMarks > currentMarks ||
        (newMarks === currentMarks &&
          new Date(answer.submission_date) > new Date(current?.submission_date))
      ) {
        bestAttempt[pid][sid] = answer;
      }
    }

    // Flatten to a clean "one row per student per paper" array
    // Use this everywhere instead of allAnswers for stats
    const deduplicatedAnswers = Object.entries(bestAttempt).flatMap(([pid, students]) =>
      Object.values(students)
    );
    // ── 4. Group answers by paper ────────────────────────────────────────────
    const byPaper = {};
    for (const paperId of paperIds) byPaper[paperId] = { all: [], mine: null };

    for (const answer of deduplicatedAnswers) {
      const pid = answer.test_series?.id;
      if (pid && byPaper[pid]) {
        byPaper[pid].all.push(answer.marks ?? 0);
        if (answer.student?.id === studentId) {
          if (!byPaper[pid].mine || new Date(answer.submission_date) > new Date(byPaper[pid].mine.submission_date)) {
            byPaper[pid].mine = answer;
          }
        }
      }
    }

    // ── 5. Per-paper results (unchanged) ────────────────────────────────────
    const paperResults = series.papers.map((paper) => {
      const data = byPaper[paper.id] || { all: [], mine: null };
      const allMarks = data.all;
      const myAnswer = data.mine;

      const fullMarks = (paper.question_banks || []).reduce((sum, qb) => sum + (qb.marks ?? 0), 0);
      const highestScore = allMarks.length ? Math.max(...allMarks) : null;
      const meanScore = allMarks.length
        ? parseFloat((allMarks.reduce((s, m) => s + m, 0) / allMarks.length).toFixed(2))
        : null;
      const sortedMarks = [...allMarks].sort((a, b) => a - b);
      const medianScore = sortedMarks.length
        ? sortedMarks.length % 2 === 0
          ? (sortedMarks[sortedMarks.length / 2 - 1] + sortedMarks[sortedMarks.length / 2]) / 2
          : sortedMarks[Math.floor(sortedMarks.length / 2)]
        : null;
      const myScore = myAnswer?.marks ?? null;
      const totalStudents = new Set(
        deduplicatedAnswers.filter((a) => a.test_series?.id === paper.id).map((a) => a.student?.id)
      ).size;

      let rank = null, percentile = null;
      if (myScore !== null && allMarks.length) {
        const uniqueStudentScores = {};
        deduplicatedAnswers
          .filter((a) => a.test_series?.id === paper.id)
          .forEach((a) => {
            const sid = a.student?.id;
            const m = a.marks ?? 0;
            if (!uniqueStudentScores[sid] || m > uniqueStudentScores[sid]) uniqueStudentScores[sid] = m;
          });
        const scores = Object.values(uniqueStudentScores);
        const scoredHigher = scores.filter((s) => s > myScore).length;
        rank = scoredHigher + 1;
        percentile = parseFloat((((scores.length - rank) / scores.length) * 100).toFixed(1));
      }

      return {
        id: paper.id,
        title: paper.title,
        start_date: paper.start_date,
        test_duration: paper.test_duration,
        pass_mark: paper.pass_mark,
        fullMarks,
        totalStudents,
        myScore,
        highestScore,
        meanScore,
        medianScore,
        rank,
        percentile,
        passed: paper.pass_mark !== null && myScore !== null ? myScore >= paper.pass_mark : null,
        submissionDate: myAnswer?.submission_date ?? null,
        timeTaken: myAnswer?.time_taken ?? null,
        attempted: myAnswer !== null,
      };
    });

    // ── 6. ✨ Unit-wise analysis ─────────────────────────────────────────────
    //
    // Each answer has question_n_answer[] components.
    // Each component has:
    //   .question.id        → links to question_bank
    //   .question.unit      → the unit
    //   .question_awarded_marks → marks scored on that question
    //
    // We walk every answer's question_n_answer array to build per-unit scores.

    // unitAgg[unitKey] = {
    //   unitId, unitName,
    //   possibleMarks,            ← sum of qb.marks for all QBs in this unit (from series)
    //   studentScores: { sid: totalAwarded }
    // }
    const unitAgg = {};

    // Helper: ensure unit entry exists
    const ensureUnitEntry = (unitId, unitName) => {
      const key = unitId ?? 'unassigned';
      if (!unitAgg[key]) {
        unitAgg[key] = {
          unitId: unitId ?? null,
          unitName: unitName ?? 'Unassigned',
          possibleMarks: 0,
          studentScores: {},
        };
      }
      return key;
    };

    // Pass 1: register all units + their possible marks from the series question banks
    // (so even unattempted units show up)
    for (const paper of series.papers) {
      for (const qb of paper.question_banks || []) {
        const unitId = qb.unit?.id ?? null;
        const unitName = qb.unit?.name ?? 'Unassigned';
        const key = ensureUnitEntry(unitId, unitName);
        unitAgg[key].possibleMarks += qb.marks ?? 0;
      }
    }

    // Pass 2: walk every answer's question_n_answer components → accumulate awarded marks per unit
    for (const answer of deduplicatedAnswers) {
      const sid = answer.student?.id;
      if (!sid) continue;

      const qnas = answer.question_n_answer ?? [];
      for (const qna of qnas) {
        const q = qna.question;
        if (!q) continue;

        const unitId = q.unit?.id ?? null;
        const unitName = q.unit?.name ?? 'Unassigned';
        const key = ensureUnitEntry(unitId, unitName);

        const awarded = qna.question_awarded_marks ?? 0;

        unitAgg[key].studentScores[sid] =
          (unitAgg[key].studentScores[sid] ?? 0) + awarded;
      }
    }

    // Build final unitAnalysis array
    const unitAnalysis = Object.values(unitAgg)
      .map((u) => {
        const scores = Object.values(u.studentScores);
        const myMarks = u.studentScores[studentId] ?? 0;
        const highestScore = scores.length ? Math.max(...scores) : null;
        const meanScore = scores.length
          ? parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2))
          : null;

        let rank = null, percentile = null;
        if (scores.length > 0) {
          const scoredHigher = scores.filter((s) => s > myMarks).length;
          rank = scoredHigher + 1;
          percentile = parseFloat(
            (((scores.length - rank) / scores.length) * 100).toFixed(1)
          );
        }

        const myPct =
          u.possibleMarks > 0
            ? parseFloat(((myMarks / u.possibleMarks) * 100).toFixed(1))
            : null;

        return {
          unitId: u.unitId,
          unitName: u.unitName,
          possibleMarks: u.possibleMarks,
          myMarks,
          highestScore,
          meanScore,
          rank,
          percentile,
          myPct,
          totalStudents: scores.length,
        };
      })
      .sort((a, b) => (b.myMarks ?? 0) - (a.myMarks ?? 0));

    // ── 7. Series-level aggregate stats ─────────────────────────────────────
    const attemptedPapers = paperResults.filter((p) => p.attempted);
    const seriesMyTotal = attemptedPapers.reduce((s, p) => s + (p.myScore ?? 0), 0);
    const seriesHighest = paperResults.reduce((s, p) => s + (p.highestScore ?? 0), 0);
    const seriesMean = paperResults.reduce((s, p) => s + (p.meanScore ?? 0), 0);
    const seriesMedian = paperResults.reduce((s, p) => s + (p.medianScore ?? 0), 0);
    const seriesFullMarks = paperResults.reduce((s, p) => s + (p.fullMarks ?? 0), 0);

    const allStudentTotals = {};
    for (const answer of deduplicatedAnswers) {
      const sid = answer.student?.id;
      if (!sid) continue;
      allStudentTotals[sid] = (allStudentTotals[sid] ?? 0) + (answer.marks ?? 0);
    }
    const totalScores = Object.values(allStudentTotals);
    const myTotal = allStudentTotals[studentId] ?? 0;
    const globalRank = totalScores.filter((s) => s > myTotal).length + 1;
    const globalPercentile = totalScores.length > 0
      ? parseFloat((((totalScores.length - globalRank) / totalScores.length) * 100).toFixed(1))
      : null;

    // ── 8. Chart & Table ────────────────────────────────────────────────────
    const chart = paperResults.map((p) => ({
      paperId: p.id, paperTitle: p.title, fullMarks: p.fullMarks,
      highestScore: p.highestScore, myScore: p.myScore, meanScore: p.meanScore,
    }));

    const table = paperResults
      .filter((p) => p.attempted)
      .map((p, idx) => ({
        sno: idx + 1, paperId: p.id, paperTitle: p.title, fullMarks: p.fullMarks,
        rank: p.rank, percentile: p.percentile, myScore: p.myScore,
        highestScore: p.highestScore, meanScore: p.meanScore, passed: p.passed,
        submissionDate: p.submissionDate, timeTaken: p.timeTaken,
      }));

    // ── 9. Attempt progression (my attempts only, per paper) ────────────────
    const myProgression = paperIds.map((paperId) => {
      const myAttempts = (allAttemptsByStudent[studentId]?.[paperId] ?? [])
        .sort((a, b) => new Date(a.submission_date) - new Date(b.submission_date))
        .map((attempt, idx) => ({
          attemptNumber: idx + 1,
          marks: attempt.marks ?? null,
          submissionDate: attempt.submission_date,
          timeTaken: attempt.time_taken ?? null,
          // Unit breakdown per attempt (walk question_n_answer)
          unitBreakdown: (() => {
            const breakdown = {};
            for (const qna of attempt.question_n_answer ?? []) {
              const unitId = qna.question?.unit?.id ?? 'unassigned';
              const unitName = qna.question?.unit?.name ?? 'Unassigned';
              if (!breakdown[unitId]) breakdown[unitId] = { unitId, unitName, awarded: 0 };
              breakdown[unitId].awarded += qna.question_awarded_marks ?? 0;
            }
            return Object.values(breakdown);
          })(),
        }));

      const paper = series.papers.find((p) => p.id === paperId);
      return {
        paperId,
        paperTitle: paper?.title ?? `Paper #${paperId}`,
        fullMarks: (paper?.question_banks ?? []).reduce((s, qb) => s + (qb.marks ?? 0), 0),
        attempts: myAttempts,
        improved: myAttempts.length >= 2
          ? (myAttempts.at(-1).marks ?? 0) - (myAttempts[0].marks ?? 0)
          : null,
      };
    }).filter((p) => p.attempts.length > 0);

    return ctx.send({
      series: {
        id: series.id, title: series.title, program_type: series.program_type,
        grade_subject: series.grade_subject, totalPapers: paperIds.length,
        attemptedPapers: attemptedPapers.length, fullMarks: seriesFullMarks,
      },
      stats: {
        myTotal: seriesMyTotal, highestTotal: seriesHighest, fullMarksTotal: seriesFullMarks,
        meanTotal: parseFloat(seriesMean.toFixed(2)),
        medianTotal: parseFloat(seriesMedian.toFixed(2)),
        globalRank, globalPercentile,
        totalStudents: Object.keys(allStudentTotals).length,
        scopedToClassroom: !!classroomId,
      },
      papers: paperResults,
      chart,
      table,
      myProgression,
      unitAnalysis,   // ← NEW
    });
  },
  async progress(ctx) {
    const { gradeSubjectId } = ctx.params;
    const { classroomId } = ctx.query;
    const studentId = ctx.state.user?.id;

    if (!studentId) return ctx.unauthorized('You must be logged in.');

    // ── 1. Verify the grade subject exists ───────────────────────────────────
    const gradeSubject = await strapi.entityService.findOne(
      'api::grade-subject.grade-subject',
      gradeSubjectId,
      { fields: ['id', 'name'] }
    );
    if (!gradeSubject) return ctx.notFound('Grade subject not found.');

    // ── 2. Find all test series + standalone papers under this grade subject ─
    // We want entity_type = 'paper' directly linked to this grade_subject,
    // OR entity_type = 'series' (we'll get their papers too).
    // Simplest: fetch all test_series with this grade_subject regardless of entity_type,
    // then separately fetch all papers (children) of any series found.
    const allSeriesAndPapers = await strapi.entityService.findMany(
      'api::test-serie.test-serie',
      {
        filters: {
          grade_subject: { id: { $eq: gradeSubjectId } },
          publishedAt: { $notNull: true },
        },
        fields: ['id', 'title', 'entity_type', 'start_date', 'test_duration', 'pass_mark', 'program_type', 'year'],
        populate: {
          question_banks: {
            fields: ['id', 'marks'],
            populate: { unit: { fields: ['id', 'name'] } },
          },
          papers: {
            fields: ['id', 'title', 'entity_type', 'start_date', 'test_duration', 'pass_mark'],
            populate: {
              question_banks: {
                fields: ['id', 'marks'],
                populate: { unit: { fields: ['id', 'name'] } },
              },
            },
          },
        },
        pagination: { limit: -1 },
      }
    );

    // Flatten: collect all paper-level test IDs the student could have answered
    // A "paper" can be:
    //   (a) entity_type === 'paper' directly under grade_subject
    //   (b) children (papers) of a series under grade_subject
    
const testMap = new Map();

for (const item of allSeriesAndPapers) {
  if (item.entity_type === 'paper') {
    testMap.set(item.id, {
      id: item.id,
      title: item.title,
      parentSeriesId: null,
      parentSeriesTitle: null,
      programType: item.program_type,
      year: item.year,
      pass_mark: item.pass_mark,
      start_date: item.start_date,
      question_banks: item.question_banks ?? [],
    });
  }

  if (item.entity_type === 'series') {
    for (const paper of item.papers ?? []) {
      testMap.set(paper.id, {
        id: paper.id,
        title: paper.title,
        parentSeriesId: item.id,
        parentSeriesTitle: item.title,
        programType: item.program_type,
        year: item.year,
        pass_mark: paper.pass_mark,
        start_date: paper.start_date,
        question_banks: paper.question_banks ?? [],
      });
    }
  }
}

const testableItems = Array.from(testMap.values());

    if (testableItems.length === 0) {
      return ctx.send({
        gradeSubject,
        summary: null,
        tests: [],
        unitAnalysis: [],
        scoreTimeline: [],
      });
    }

    const allTestIds = testableItems.map((t) => t.id);

    // ── 3. Fetch all evaluated answers for these tests ───────────────────────
    const baseFilter = {
      test_series: { id: { $in: allTestIds } },
      completed: { $eq: true },
      is_attempt_marker: { $eq: false },
      evaluation_status: { $eq: 'evaluated' },
    };
    if (classroomId) baseFilter.tutor_classroom = { id: { $eq: classroomId } };

    const allAnswers = await strapi.entityService.findMany('api::answer.answer', {
      filters: baseFilter,
      fields: ['id', 'marks', 'submission_date', 'time_taken'],
      populate: {
        student: { fields: ['id'] },
        test_series: { fields: ['id'] },
        question_n_answer: {
          populate: {
            question: {
              fields: ['id'],
              populate: { unit: { fields: ['id', 'name'] } },
            },
          },
        },
      },
      pagination: { limit: -1 },
    });

    // ── 4. Deduplicate: best attempt per student per test ────────────────────
    const bestAttempt = {};       // testId → { studentId → answer }
    const myAllAttempts = {};     // testId → answer[] (only mine, for timeline)

    for (const answer of allAnswers) {
      const tid = answer.test_series?.id;
      const sid = answer.student?.id;
      if (!tid || !sid) continue;

      // Track my attempts for timeline
      if (sid === studentId) {
        if (!myAllAttempts[tid]) myAllAttempts[tid] = [];
        myAllAttempts[tid].push(answer);
      }

      // Best attempt per student per test
      if (!bestAttempt[tid]) bestAttempt[tid] = {};
      const current = bestAttempt[tid][sid];
      const currentMarks = current?.marks ?? -Infinity;
      const newMarks = answer.marks ?? 0;
      if (
        newMarks > currentMarks ||
        (newMarks === currentMarks &&
          new Date(answer.submission_date) > new Date(current?.submission_date))
      ) {
        bestAttempt[tid][sid] = answer;
      }
    }

    const deduplicatedAnswers = Object.values(bestAttempt).flatMap((students) =>
      Object.values(students)
    );
const attemptedTestIds = new Set(
  Object.keys(myAllAttempts).map(Number)
);

const attemptedTestObjects = testableItems.filter(t =>
  attemptedTestIds.has(t.id)
);
    // ── 5. Per-test stats ────────────────────────────────────────────────────
    const testResults = testableItems.map((test) => {
      const studentAnswers = Object.values(bestAttempt[test.id] ?? {});
      const allMarks = studentAnswers.map((a) => a.marks ?? 0);
      const myBest = bestAttempt[test.id]?.[studentId] ?? null;
      const myScore = myBest?.marks ?? null;

      const fullMarks = test.question_banks.reduce((s, qb) => s + (qb.marks ?? 0), 0);
      const highestScore = allMarks.length ? Math.max(...allMarks) : null;
      const meanScore = allMarks.length
        ? parseFloat((allMarks.reduce((a, b) => a + b, 0) / allMarks.length).toFixed(2))
        : null;

      let rank = null, percentile = null;
      if (myScore !== null && allMarks.length) {
        const scoredHigher = allMarks.filter((s) => s > myScore).length;
        rank = scoredHigher + 1;
        percentile = parseFloat((((allMarks.length - rank) / allMarks.length) * 100).toFixed(1));
      }

      const myAttempts = (myAllAttempts[test.id] ?? [])
        .sort((a, b) => new Date(a.submission_date) - new Date(b.submission_date));

      return {
        testId: test.id,
        title: test.title,
        parentSeriesId: test.parentSeriesId,
        parentSeriesTitle: test.parentSeriesTitle,
        programType: test.programType,
        year: test.year,
        fullMarks,
        pass_mark: test.pass_mark,
        start_date: test.start_date,
        totalStudents: studentAnswers.length,
        // My stats
        attempted: myBest !== null,
        myScore,
        myBestDate: myBest?.submission_date ?? null,
        myTimeTaken: myBest?.time_taken ?? null,
        passed: test.pass_mark != null && myScore != null ? myScore >= test.pass_mark : null,
        attemptCount: myAttempts.length,
        // Class stats
        highestScore,
        meanScore,
        rank,
        percentile,
        // All my attempts (for micro-sparkline on frontend)
        myAttempts: myAttempts.map((a, idx) => ({
          attemptNumber: idx + 1,
          marks: a.marks ?? null,
          submissionDate: a.submission_date,
          timeTaken: a.time_taken ?? null,
        })),
      };
    });

    // ── 6. Unit-wise analysis (aggregated across all tests) ─────────────────
    const unitAgg = {};

    const ensureUnit = (unitId, unitName) => {
      const key = unitId ?? 'unassigned';
      if (!unitAgg[key]) {
        unitAgg[key] = {
          unitId: unitId ?? null,
          unitName: unitName ?? 'Unassigned',
          possibleMarks: 0,
          studentScores: {},
        };
      }
      return key;
    };

    // Pass 1: register all units from all question banks
    for (const test of attemptedTestObjects) {
      for (const qb of test.question_banks) {
        const key = ensureUnit(qb.unit?.id ?? null, qb.unit?.name ?? 'Unassigned');
        unitAgg[key].possibleMarks += qb.marks ?? 0;
      }
    }

    // Pass 2: accumulate awarded marks per unit from best attempts
    for (const answer of deduplicatedAnswers) {
        const tid = answer.test_series?.id;
  if (!attemptedTestIds.has(tid)) continue;
      const sid = answer.student?.id;
      if (!sid) continue;
      for (const qna of answer.question_n_answer ?? []) {
        const q = qna.question;
        if (!q) continue;
        const key = ensureUnit(q.unit?.id ?? null, q.unit?.name ?? 'Unassigned');
        unitAgg[key].studentScores[sid] =
          (unitAgg[key].studentScores[sid] ?? 0) + (qna.question_awarded_marks ?? 0);
      }
    }

    const unitAnalysis = Object.values(unitAgg).map((u) => {
      const scores = Object.values(u.studentScores);
      const myMarks = u.studentScores[studentId] ?? 0;
      const highestScore = scores.length ? Math.max(...scores) : null;
      const meanScore = scores.length
        ? parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2))
        : null;

      let rank = null, percentile = null;
      if (scores.length > 0) {
        const scoredHigher = scores.filter((s) => s > myMarks).length;
        rank = scoredHigher + 1;
        percentile = parseFloat((((scores.length - rank) / scores.length) * 100).toFixed(1));
      }

      const myPct = u.possibleMarks > 0
        ? parseFloat(((myMarks / u.possibleMarks) * 100).toFixed(1))
        : null;

      return {
        unitId: u.unitId,
        unitName: u.unitName,
        possibleMarks: u.possibleMarks,
        myMarks,
        highestScore,
        meanScore,
        rank,
        percentile,
        myPct,
        totalStudents: scores.length,
      };
    }).sort((a, b) => (b.myMarks ?? 0) - (a.myMarks ?? 0));

    // ── 7. Score timeline ────────────────────────────────────────────────────
    // Chronological list of all MY attempts across all tests, for a progress graph
    const scoreTimeline = Object.entries(myAllAttempts)
      .flatMap(([testId, attempts]) => {
        const test = testableItems.find((t) => t.id === Number(testId));
        return attempts.map((a) => ({
          date: a.submission_date,
          testId: Number(testId),
          testTitle: test?.title ?? `Test #${testId}`,
          parentSeriesTitle: test?.parentSeriesTitle ?? null,
          marks: a.marks ?? null,
          fullMarks: test?.question_banks.reduce((s, qb) => s + (qb.marks ?? 0), 0) ?? null,
        }));
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    // ── 8. Summary stats ─────────────────────────────────────────────────────
    const attemptedTests = testResults.filter((t) => t.attempted);
    const totalMyMarks = attemptedTests.reduce((s, t) => s + (t.myScore ?? 0), 0);
    const totalPossible = attemptedTests.reduce((s, t) => s + (t.fullMarks ?? 0), 0);
    const totalHighest = attemptedTests.reduce((s, t) => s + (t.highestScore ?? 0), 0);
    const totalMean = attemptedTests.reduce((s, t) => s + (t.meanScore ?? 0), 0);

    // Overall rank across all students (sum of best attempts)
    const allStudentTotals = {};
    for (const answer of deduplicatedAnswers) {
      const sid = answer.student?.id;
      if (!sid) continue;
      allStudentTotals[sid] = (allStudentTotals[sid] ?? 0) + (answer.marks ?? 0);
    }
    const totalScores = Object.values(allStudentTotals);
    const myGrandTotal = allStudentTotals[studentId] ?? 0;
    const overallRank = totalScores.filter((s) => s > myGrandTotal).length + 1;
    const overallPercentile = totalScores.length > 0
      ? parseFloat((((totalScores.length - overallRank) / totalScores.length) * 100).toFixed(1))
      : null;

    return ctx.send({
      gradeSubject,
      summary: {
        totalTests: testableItems.length,
        attemptedTests: attemptedTests.length,
        myTotal: totalMyMarks,
        possibleTotal: totalPossible,
        highestTotal: totalHighest,
        meanTotal: parseFloat(totalMean.toFixed(2)),
        overallRank,
        overallPercentile,
        totalStudents: Object.keys(allStudentTotals).length,
        scopedToClassroom: !!classroomId,
      },
      tests: testResults,
      unitAnalysis,
      scoreTimeline,
    });
  }
}));
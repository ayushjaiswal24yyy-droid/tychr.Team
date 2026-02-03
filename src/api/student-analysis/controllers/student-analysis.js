"use strict";

module.exports = {
  async yearly(ctx) {
    try {
      const { studentId, classroomId } = ctx.request.query;

      if (!studentId || !classroomId) {
        return ctx.badRequest("studentId and classroomId are required");
      }

      // 1. Get student's purchase date for this classroom from payment
      const payment = await strapi.entityService.findMany(
        "api::payment.payment",
        {
          filters: {
            student: studentId,
            classroom: classroomId,
            status: "active",
            purchased_at: { $notNull: true },
          },
          sort: "purchased_at:asc",
          limit: 1,
          fields: ["purchased_at"],
        }
      );

      if (!payment.length) {
        return {
          yearlyData: [],
          overallStats: {
            totalYears: 0,
            overallAverage: 0,
            totalTests: 0,
            improvementRate: "0%",
            currentRank: "N/A",
            message: "No active subscription found for this classroom.",
          },
        };
      }

      const purchaseDate = payment[0].purchased_at;
      const enrollmentYear = new Date(purchaseDate).getFullYear();
      const currentYear = new Date().getFullYear();

      // 2. Get all test series answers for this student and classroom
      const answers = await strapi.entityService.findMany(
        "api::answer.answer",
        {
          filters: {
            student: studentId,
            tutor_classroom: classroomId,
            test_series: {
              test_type: "Test Series",
            },
            marks: { $notNull: true },
            submission_date: { $gte: purchaseDate },
          },
          populate: {
            test_series: {
              fields: ["id", "title"],
            },
          },
          sort: "submission_date:asc",
        }
      );

      if (!answers.length) {
        // Return years from purchase to current year with empty data
        const yearlyData = [];
        for (let year = enrollmentYear; year <= currentYear; year++) {
          yearlyData.push({
            year,
            totalTests: 0,
            averageScore: 0,
            highestScore: 0,
            lowestScore: 0,
            testsTaken: [],
          });
        }

        return {
          yearlyData,
          overallStats: {
            totalYears: currentYear - enrollmentYear + 1,
            overallAverage: 0,
            totalTests: 0,
            improvementRate: "0%",
            currentRank: "N/A",
            enrollmentYear,
            currentYear,
            purchaseDate,
            message:
              "No test series attempts found since your subscription started.",
          },
        };
      }

      // 3. Get first attempts only
      const firstAttempts = this.getFirstAttempts(answers);

      // 4. Group by year
      const yearlyMap = {};

      firstAttempts.forEach((attempt) => {
        if (!attempt.submission_date || attempt.marks === null) return;

        const year = new Date(attempt.submission_date).getFullYear();
        if (!yearlyMap[year]) {
          yearlyMap[year] = {
            scores: [],
            tests: [],
          };
        }
        const score = parseFloat(attempt.marks);
        if (!isNaN(score)) {
          yearlyMap[year].scores.push(score);
          yearlyMap[year].tests.push({
            testId: attempt.test_series?.id,
            testTitle: attempt.test_series?.title || "Unknown Test",
            score: score,
            date: attempt.submission_date,
          });
        }
      });

      // 5. Build yearly data array for all years from purchase
      const yearlyData = [];
      for (let year = enrollmentYear; year <= currentYear; year++) {
        if (yearlyMap[year] && yearlyMap[year].scores.length > 0) {
          const scores = yearlyMap[year].scores;
          yearlyData.push({
            year,
            totalTests: scores.length,
            averageScore: parseFloat(
              (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
            ),
            highestScore: parseFloat(Math.max(...scores).toFixed(1)),
            lowestScore: parseFloat(Math.min(...scores).toFixed(1)),
            testsTaken: yearlyMap[year].tests,
          });
        } else {
          yearlyData.push({
            year,
            totalTests: 0,
            averageScore: 0,
            highestScore: 0,
            lowestScore: 0,
            testsTaken: [],
          });
        }
      }

      // 6. Calculate overall stats
      const yearsWithTests = yearlyData.filter((y) => y.totalTests > 0);
      const allScores = firstAttempts
        .map((a) => parseFloat(a.marks))
        .filter((score) => !isNaN(score));

      return {
        yearlyData,
        overallStats: {
          totalYears: yearsWithTests.length,
          overallAverage:
            allScores.length > 0
              ? parseFloat(
                (
                  allScores.reduce((a, b) => a + b, 0) / allScores.length
                ).toFixed(1)
              )
              : 0,
          totalTests: allScores.length,
          improvementRate: this.calculateImprovementRate(yearsWithTests),
          enrollmentYear,
          currentYear,
          purchaseDate: purchaseDate,
          subscriptionActive: true,
        },
      };
    } catch (err) {
      console.error("Error in yearly analysis:", err);
      return {
        yearlyData: [],
        overallStats: {
          totalYears: 0,
          overallAverage: 0,
          totalTests: 0,
          improvementRate: "0%",
          error: "Unable to load yearly data. Please try again later.",
        },
      };
    }
  },

  async unitWise(ctx) {
    try {
      const { studentId, classroomId } = ctx.request.query;

      if (!studentId || !classroomId) {
        return ctx.badRequest("studentId and classroomId are required");
      }

      // 1. Check if student has active subscription
      const activePayment = await strapi.entityService.findMany(
        "api::payment.payment",
        {
          filters: {
            student: studentId,
            classroom: classroomId,
            status: "active",
          },
          limit: 1,
        }
      );

      if (!activePayment.length) {
        return {
          unitAnalysis: [],
          recommendations: [],
          summary: {
            totalUnits: 0,
            strongUnits: [],
            weakUnits: [],
            averageUnits: [],
            overallAccuracy: 0,
            message: "Active subscription required to view unit analysis.",
          },
        };
      }

      // 2. Get answers with unit data
      const answers = await strapi.entityService.findMany(
        "api::answer.answer",
        {
          filters: {
            student: studentId,
            tutor_classroom: classroomId,
            test_series: {
              test_type: "Test Series",
            },
            marks: { $notNull: true },
          },
          populate: {
            test_series: {
              populate: {
                question_banks: {
                  populate: {
                    unit: {
                      fields: ["id", "name"],
                    },
                  },
                },
              },
            },
            question_n_answer: true,
          },
          sort: "submission_date:desc",
          limit: 50, // Limit for performance
        }
      );

      if (!answers.length) {
        return {
          unitAnalysis: [],
          recommendations: [],
          summary: {
            totalUnits: 0,
            strongUnits: [],
            weakUnits: [],
            averageUnits: [],
            overallAccuracy: 0,
            message: "Complete some test series to see unit-wise performance.",
          },
        };
      }

      // 3. Get first attempts only
      const firstAttempts = this.getFirstAttempts(answers);

      // 4. Analyze unit-wise performance
      const unitPerformance = {};
      let totalQuestionsAnalyzed = 0;
      let totalCorrectQuestions = 0;

      for (const attempt of firstAttempts) {
        const questionNAnswer = attempt.question_n_answer || [];

        // For each answer, try to match with unit
        for (let i = 0; i < questionNAnswer.length; i++) {
          const qna = questionNAnswer[i];

          // Try to find unit from question_n_answer or test series
          let unitId = null;
          let unitName = "Unknown Unit";

          // Check if qna has unit info
          if (qna.unitId || qna.unit) {
            unitId = qna.unitId || qna.unit?.id;
            unitName = qna.unitName || qna.unit?.name || "Unknown Unit";
          }
          // If not, try to get from test series question banks
          else if (attempt.test_series?.question_banks?.[i]?.unit) {
            const questionBank = attempt.test_series.question_banks[i];
            unitId = questionBank.unit.id;
            unitName = questionBank.unit.name;
          }

          if (unitId) {
            if (!unitPerformance[unitId]) {
              unitPerformance[unitId] = {
                unitId,
                unitName,
                totalQuestions: 0,
                correctAnswers: 0,
                questions: [],
              };
            }

            const isCorrect = this.checkAnswerCorrectness(qna);

            unitPerformance[unitId].totalQuestions++;
            if (isCorrect) {
              unitPerformance[unitId].correctAnswers++;
            }

            unitPerformance[unitId].questions.push({
              questionNumber: i + 1,
              isCorrect,
              marks: qna.marksObtained || 0,
              totalMarks: qna.totalMarks || 1,
            });

            totalQuestionsAnalyzed++;
            if (isCorrect) totalCorrectQuestions++;
          }
        }
      }

      // 5. Convert to array and calculate percentages
      const unitAnalysis = Object.values(unitPerformance).map((unit) => {
        const accuracy =
          unit.totalQuestions > 0
            ? (unit.correctAnswers / unit.totalQuestions) * 100
            : 0;

        return {
          ...unit,
          percentage: parseFloat(accuracy.toFixed(1)),
          strength: this.getStrengthLevel(accuracy),
        };
      });

      // 6. Sort and categorize
      const sortedUnits = unitAnalysis.sort(
        (a, b) => b.percentage - a.percentage
      );

      const strongUnits = sortedUnits.filter((u) => u.percentage >= 80);
      const weakUnits = sortedUnits.filter((u) => u.percentage < 60);
      const averageUnits = sortedUnits.filter(
        (u) => u.percentage >= 60 && u.percentage < 80
      );

      // 7. Generate practical recommendations
      const recommendations = [];

      // Focus on weakest units first
      weakUnits.slice(0, 3).forEach((unit) => {
        recommendations.push({
          unit: unit.unitName,
          currentScore: unit.percentage,
          suggestion: this.getUnitSuggestion(unit.percentage),
          priority: "high",
          actionSteps: [
            "Review basic concepts",
            "Practice 10-15 questions",
            "Take a focused quiz",
          ],
        });
      });

      // Add positive feedback for strong units
      if (strongUnits.length > 0) {
        recommendations.push({
          unit: strongUnits[0].unitName,
          currentScore: strongUnits[0].percentage,
          suggestion:
            "Excellent performance! Consider helping classmates or exploring advanced topics.",
          priority: "low",
          type: "reinforcement",
        });
      }

      return {
        unitAnalysis: sortedUnits,
        recommendations,
        summary: {
          totalUnits: sortedUnits.length,
          strongUnits: strongUnits.map((u) => ({
            name: u.unitName,
            score: u.percentage,
            count: u.totalQuestions,
          })),
          weakUnits: weakUnits.map((u) => ({
            name: u.unitName,
            score: u.percentage,
            count: u.totalQuestions,
          })),
          averageUnits: averageUnits.map((u) => ({
            name: u.unitName,
            score: u.percentage,
            count: u.totalQuestions,
          })),
          overallAccuracy:
            totalQuestionsAnalyzed > 0
              ? parseFloat(
                (
                  (totalCorrectQuestions / totalQuestionsAnalyzed) *
                  100
                ).toFixed(1)
              )
              : 0,
          totalQuestionsAnalyzed,
          totalCorrectQuestions,
        },
      };
    } catch (err) {
      console.error("Error in unit-wise analysis:", err);
      return {
        unitAnalysis: [],
        recommendations: [],
        summary: {
          totalUnits: 0,
          strongUnits: [],
          weakUnits: [],
          averageUnits: [],
          overallAccuracy: 0,
          error: "Unable to load unit analysis. Please try again later.",
        },
      };
    }
  },

  async lastFiveFirstAttempts(ctx) {
    try {
      const { studentId, classroomId } = ctx.request.query;

      if (!studentId || !classroomId) {
        return ctx.badRequest("studentId and classroomId are required");
      }

      // Get latest answers (newest first)
      const answers = await strapi.entityService.findMany(
        "api::answer.answer",
        {
          filters: {
            student: studentId,
            tutor_classroom: classroomId,
            test_series: {
              test_type: "Test Series",
            },
            marks: { $notNull: true },
          },
          populate: {
            test_series: {
              fields: ["id", "title", "program_type"],
            },
          },
          sort: "submission_date:desc",
          limit: 20,
        }
      );

      if (!answers.length) {
        return {
          attempts: [],
          summary: {
            totalAttempts: 0,
            message: "No test attempts found. Start with your first test!",
          },
        };
      }

      // Get unique tests by taking most recent submission for each test
      const uniqueTests = {};
      answers.forEach((answer) => {
        const testId = answer.test_series?.id;
        if (!testId) return;

        if (!uniqueTests[testId]) {
          uniqueTests[testId] = answer;
        }
      });

      // Take last 5 unique tests
      const lastFiveAttempts = Object.values(uniqueTests)
        .slice(0, 5)
        .map((attempt, index) => {
          const score = parseFloat(attempt.marks) || 0;
          const date = new Date(attempt.submission_date);

          return {
            attemptNumber: index + 1,
            testId: attempt.test_series?.id,
            testTitle: attempt.test_series?.title || "Test",
            score: score,
            date: attempt.submission_date,
            formattedDate: date.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            }),
            programType: attempt.test_series?.program_type || "N/A",
            performance: this.getPerformanceCategory(score),
          };
        });

      // Calculate summary
      const scores = lastFiveAttempts.map((a) => a.score);
      const avgScore =
        scores.length > 0
          ? scores.reduce((a, b) => a + b, 0) / scores.length
          : 0;

      return {
        attempts: lastFiveAttempts,
        summary: {
          totalAttempts: lastFiveAttempts.length,
          averageScore: parseFloat(avgScore.toFixed(1)),
          highestScore: Math.max(...scores),
          lowestScore: Math.min(...scores),
          latestTest: lastFiveAttempts[0]?.testTitle || "N/A",
          latestScore: lastFiveAttempts[0]?.score || 0,
        },
      };
    } catch (err) {
      console.error("Error in last five attempts analysis:", err);
      return {
        attempts: [],
        summary: {
          totalAttempts: 0,
          error: "Unable to load recent attempts. Please try again later.",
        },
      };
    }
  },

  async monthlyTrend(ctx) {
    let yearNum;
    try {
      const { studentId, classroomId, year } = ctx.request.query;

      if (!studentId || !classroomId || !year) {
        return ctx.badRequest("studentId, classroomId, and year are required");
      }

      yearNum = parseInt(year);
      const currentYear = new Date().getFullYear();

      if (yearNum > currentYear) {
        return ctx.badRequest("Cannot view future year data");
      }

      // Get payment date to check subscription start
      const payment = await strapi.entityService.findMany(
        "api::payment.payment",
        {
          filters: {
            student: studentId,
            classroom: classroomId,
            status: "active",
          },
          sort: "purchased_at:asc",
          limit: 1,
          fields: ["purchased_at"],
        }
      );

      if (!payment.length) {
        // Return empty data
        const emptyMonths = Array.from({ length: 12 }, (_, i) => ({
          month: new Date(yearNum, i, 1).toLocaleString("default", {
            month: "short",
          }),
          totalTests: 0,
          averageScore: 0,
        }));

        return {
          year: yearNum,
          monthlyStats: emptyMonths,
          summary: {
            yearAverage: 0,
            totalTestsYear: 0,
            bestMonth: "N/A",
            message: "No active subscription found for this classroom.",
          },
        };
      }

      const subscriptionStart = new Date(payment[0].purchased_at);

      // Only get data from subscription start date
      const startDate =
        subscriptionStart.getFullYear() === yearNum
          ? subscriptionStart
          : new Date(yearNum, 0, 1);

      // Get answers for the selected year
      const answers = await strapi.entityService.findMany(
        "api::answer.answer",
        {
          filters: {
            student: studentId,
            tutor_classroom: classroomId,
            test_series: {
              test_type: "Test Series",
            },
            marks: { $notNull: true },
            submission_date: {
              $gte: startDate.toISOString(),
              $lte: new Date(yearNum, 11, 31, 23, 59, 59).toISOString(),
            },
          },
          populate: {
            test_series: {
              fields: ["title"],
            },
          },
          sort: "submission_date:asc",
        }
      );

      // Initialize monthly data
      const monthlyData = Array.from({ length: 12 }, (_, i) => ({
        month: new Date(yearNum, i, 1).toLocaleString("default", {
          month: "short",
        }),
        totalTests: 0,
        averageScore: 0,
        tests: [],
      }));

      // Group by month
      answers.forEach((answer) => {
        if (!answer.submission_date) return;

        const date = new Date(answer.submission_date);
        const month = date.getMonth();

        if (date.getFullYear() === yearNum) {
          const score = parseFloat(answer.marks) || 0;
          monthlyData[month].totalTests++;
          monthlyData[month].tests.push({
            testTitle: answer.test_series?.title || "Test",
            score: score,
            date: answer.submission_date,
          });
        }
      });

      // Calculate monthly averages
      monthlyData.forEach((month) => {
        if (month.totalTests > 0) {
          const totalScore = month.tests.reduce(
            (sum, test) => sum + test.score,
            0
          );
          month.averageScore = parseFloat(
            (totalScore / month.totalTests).toFixed(1)
          );
        }
      });

      // Filter months with tests
      const monthsWithTests = monthlyData.filter((m) => m.totalTests > 0);
      const allScores = monthsWithTests.flatMap((m) =>
        m.tests.map((t) => t.score)
      );
      const yearAverage =
        allScores.length > 0
          ? allScores.reduce((a, b) => a + b, 0) / allScores.length
          : 0;

      // Find best month
      const bestMonth = monthsWithTests.reduce(
        (best, current) => {
          return current.averageScore > best.averageScore ? current : best;
        },
        { averageScore: -1, month: "N/A" }
      );

      return {
        year: yearNum,
        monthlyStats: monthlyData,
        summary: {
          yearAverage: parseFloat(yearAverage.toFixed(1)),
          totalTestsYear: answers.length,
          bestMonth: bestMonth.month,
          bestMonthScore: bestMonth.averageScore,
          activeMonths: monthsWithTests.length,
          subscriptionStart: subscriptionStart.toISOString().split("T")[0],
        },
      };
    } catch (err) {
      console.error("Error in monthly trend analysis:", err);
      return {
        year: yearNum,
        monthlyStats: Array.from({ length: 12 }, (_, i) => ({
          month: new Date(yearNum, i, 1).toLocaleString("default", {
            month: "short",
          }),
          totalTests: 0,
          averageScore: 0,
        })),
        summary: {
          yearAverage: 0,
          totalTestsYear: 0,
          bestMonth: "N/A",
          error: "Unable to load monthly data. Please try again later.",
        },
      };
    }
  },
  async getWeeklyProgress(ctx) {
    try {
      /* ----------------------------
         1. AUTH CHECK
      ----------------------------- */
      const user = ctx.state.user;

      if (!user) {
        return ctx.unauthorized("User not authenticated");
      }

      /* ----------------------------
         2. RESOLVE WEEK RANGE
      ----------------------------- */
      const { week } = ctx.query;

      if (!week) {
        return ctx.badRequest("Week date is required");
      }

const inputDate = new Date(week);

if (Number.isNaN(inputDate.getTime())) {
  return ctx.badRequest("Invalid week date");
}


      // Monday start
      const startOfWeek = new Date(inputDate);
      const day = startOfWeek.getDay();
      const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
      startOfWeek.setDate(diff);
      startOfWeek.setHours(0, 0, 0, 0);

      // Sunday end
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      /* ----------------------------
         3. FETCH TEST ANSWERS
      ----------------------------- */
      const answers = await strapi.entityService.findMany(
        "api::answer.answer",
        {
          filters: {
            student: user.id,
            completed: true,
            is_attempt_marker: { $ne: true },
            submission_date: {
              $gte: startOfWeek,
              $lte: endOfWeek,
            },
          },
          populate: {
            question_n_answer: {
              populate: {
                question: true,
              },
            },
          },
        }
      );

      /* ----------------------------
         4. AGGREGATE TEST DATA
      ----------------------------- */
      let totalMarksScored = 0;
      let totalPossibleMarks = 0;
      let totalTestTime = 0;

      const uniqueAttempts = new Set();

      for (const ans of answers) {
        uniqueAttempts.add(ans.attempt_id);

        totalMarksScored += ans.marks || 0;
        totalTestTime += ans.time_taken || 0;

        if (ans.question_n_answer) {
          for (const qna of ans.question_n_answer) {
            totalPossibleMarks += qna.question?.marks || 0;
          }
        }
      }

      /* ----------------------------
         5. FETCH ATTENDANCE
      ----------------------------- */
      const attendance = await strapi.entityService.findMany(
        "api::attendance.attendance",
        {
          filters: {
            student: user.id,
            joined_at: {
              $gte: startOfWeek,
              $lte: endOfWeek,
            },
          },
        }
      );

      /* ----------------------------
         6. AGGREGATE ATTENDANCE
      ----------------------------- */
      let present = 0;
      let absent = 0;
      let late = 0;
      let classMinutes = 0;

      for (const a of attendance) {
        if (a.status === "present") present++;
        if (a.status === "absent") absent++;
        if (a.status === "late") late++;

        classMinutes += a.duration_minutes || 0;
      }

      const totalClasses = attendance.length;
      const attendanceRate =
        totalClasses > 0
          ? Math.round(((present + late) / totalClasses) * 100)
          : 0;

      /* ----------------------------
         7. FINAL RESPONSE
      ----------------------------- */
      return {
        data: {
          week: {
            from: startOfWeek,
            to: endOfWeek,
          },
          academics: {
            tests_attempted: uniqueAttempts.size,
            papers_completed: answers.length,
            marks_scored: totalMarksScored,
            total_marks: totalPossibleMarks,
            average_percentage:
              totalPossibleMarks > 0
                ? Math.round((totalMarksScored / totalPossibleMarks) * 100)
                : 0,
          },
          attendance: {
            total_classes: totalClasses,
            present,
            absent,
            late,
            attendance_rate: attendanceRate,
          },
          time_spent: {
            testing_minutes: totalTestTime,
            class_minutes: classMinutes,
            total_minutes: totalTestTime + classMinutes,
          },
        },
      };
    } catch (error) {
      console.error("Weekly Progress Error:", error);
      ctx.throw(500, error.message);
    }
  },
  // ==================== SIMPLIFIED HELPER METHODS ====================

  getFirstAttempts(answers) {
    const attemptsByTest = {};

    answers.forEach((answer) => {
      const testId = answer.test_series?.id;
      if (!testId || answer.marks === null) return;

      if (!attemptsByTest[testId]) {
        attemptsByTest[testId] = answer;
      }
    });

    return Object.values(attemptsByTest);
  },

  checkAnswerCorrectness(qna) {
    if (!qna || typeof qna !== "object") return false;

    // Check for isCorrect field
    if (qna.isCorrect !== undefined) {
      return qna.isCorrect === true || qna.isCorrect === "true";
    }

    // Check for marks obtained
    if (qna.marksObtained !== undefined && qna.totalMarks !== undefined) {
      return parseFloat(qna.marksObtained) >= parseFloat(qna.totalMarks) * 0.8; // 80% or more is correct
    }

    return false;
  },

  getStrengthLevel(accuracy) {
    if (accuracy >= 90) return "Excellent";
    if (accuracy >= 80) return "Strong";
    if (accuracy >= 70) return "Good";
    if (accuracy >= 60) return "Average";
    return "Needs Improvement";
  },

  getPerformanceCategory(score) {
    if (score >= 90) return "Excellent";
    if (score >= 80) return "Very Good";
    if (score >= 70) return "Good";
    if (score >= 60) return "Average";
    return "Needs Practice";
  },

  getUnitSuggestion(percentage) {
    if (percentage < 40) {
      return "Focus on understanding basic concepts. Start with foundation material.";
    } else if (percentage < 60) {
      return "Practice more problems. Review mistakes and understand solutions.";
    } else if (percentage < 80) {
      return "Good progress. Work on time management and advanced problems.";
    } else {
      return "Excellent understanding. Try teaching others or advanced topics.";
    }
  },

  calculateImprovementRate(yearsWithTests) {
    if (!yearsWithTests || yearsWithTests.length < 2) return "0%";

    const firstYear = yearsWithTests[0].averageScore;
    const lastYear = yearsWithTests[yearsWithTests.length - 1].averageScore;

    if (firstYear === 0) return "N/A";

    const improvement = ((lastYear - firstYear) / firstYear) * 100;
    const formatted = Math.abs(improvement).toFixed(1);

    if (improvement > 0) return `+${formatted}%`;
    if (improvement < 0) return `-${formatted}%`;
    return "0%";
  },
};

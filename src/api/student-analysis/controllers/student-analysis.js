"use strict";

module.exports = {
  async yearly(ctx) {
    try {
      const { studentId, classroomId } = ctx.request.query;

      if (!studentId || !classroomId) {
        return ctx.badRequest("studentId and classroomId are required");
      }

      // OPTIMIZED: Get only test series (not practice tests) with single query
      const answers = await strapi.entityService.findMany(
        "api::answer.answer",
        {
          filters: {
            student: studentId,
            tutor_classroom: classroomId,
            test_series: {
              test_type: "Test Series", // ✅ FILTER: Only Test Series
            },
          },
          populate: {
            test_series: {
              fields: ["id", "title", "test_type"],
            },
          },
          sort: "submission_date:asc",
        }
      );

      if (!answers.length) {
        return {
          yearlyData: [],
          overallStats: {
            totalYears: 0,
            overallAverage: 0,
            totalTests: 0,
            improvementRate: "0%",
            currentRank: "N/A",
          },
        };
      }

      // Get enrollment date
      const enrollment = await strapi.entityService.findOne(
        "api::enrollment.enrollment",
        classroomId,
        { fields: ["enrollment_date"] }
      );

      const enrollmentYear = new Date(
        enrollment?.enrollment_date || new Date()
      ).getFullYear();
      const currentYear = new Date().getFullYear();

      // Get first attempts only
      const firstAttempts = this.getFirstAttempts(answers);

      // Group by year
      const yearlyMap = {};

      firstAttempts.forEach((attempt) => {
        if (!attempt.submission_date) return;

        const year = new Date(attempt.submission_date).getFullYear();
        if (!yearlyMap[year]) {
          yearlyMap[year] = {
            scores: [],
            tests: [],
          };
        }
        yearlyMap[year].scores.push(parseFloat(attempt.marks || 0));
        yearlyMap[year].tests.push({
          testId: attempt.test_series?.id,
          testTitle: attempt.test_series?.title || "Unknown Test",
          score: attempt.marks,
          date: attempt.submission_date,
        });
      });

      // Build yearly data array
      const yearlyData = [];
      for (let year = enrollmentYear; year <= currentYear; year++) {
        if (yearlyMap[year]) {
          const scores = yearlyMap[year].scores;
          yearlyData.push({
            year,
            totalTests: scores.length,
            averageScore: scores.reduce((a, b) => a + b, 0) / scores.length,
            highestScore: Math.max(...scores),
            lowestScore: Math.min(...scores),
            testsTaken: yearlyMap[year].tests,
          });
        }
      }

      return {
        yearlyData,
        overallStats: {
          totalYears: yearlyData.length,
          overallAverage:
            yearlyData.length > 0
              ? yearlyData.reduce((sum, year) => sum + year.averageScore, 0) /
                yearlyData.length
              : 0,
          totalTests: yearlyData.reduce(
            (sum, year) => sum + year.totalTests,
            0
          ),
          improvementRate: this.calculateImprovementRate(yearlyData),
          currentRank: await this.getCurrentRank(studentId, classroomId),
        },
      };
    } catch (err) {
      console.error("Error in yearly analysis:", err);
      ctx.throw(500, err.message);
    }
  },

  async unitWise(ctx) {
    try {
      const { studentId, classroomId } = ctx.request.query;

      if (!studentId || !classroomId) {
        return ctx.badRequest("studentId and classroomId are required");
      }

      // OPTIMIZED: Get only test series answers with minimal data
      const answers = await strapi.entityService.findMany(
        "api::answer.answer",
        {
          filters: {
            student: studentId,
            tutor_classroom: classroomId,
            test_series: {
              test_type: "Test Series", // ✅ FILTER: Only Test Series
            },
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
                  fields: ["id", "marks"],
                },
              },
              fields: ["id"],
            },
          },
          sort: "submission_date:asc",
        }
      );

      // Get first attempts only
      const firstAttempts = this.getFirstAttempts(answers);

      // OPTIMIZED: Get question_n_answer in batch
      const answerIds = firstAttempts.map((a) => a.id);
      const answersWithQNA = await strapi.entityService.findMany(
        "api::answer.answer",
        {
          filters: {
            id: { $in: answerIds },
          },
          fields: ["id"],
          populate: {
            question_n_answer: true,
          },
        }
      );

      // Create map for quick lookup
      const qnaMap = {};
      answersWithQNA.forEach((ans) => {
        qnaMap[ans.id] = ans.question_n_answer || [];
      });

      // Analyze unit-wise performance
      const unitPerformance = {};

      firstAttempts.forEach((attempt) => {
        const questionNAnswer = qnaMap[attempt.id] || [];
        const questionBanks = attempt.test_series?.question_banks || [];

        questionNAnswer.forEach((qna, index) => {
          const question = questionBanks[index];
          if (question?.unit) {
            const unitId = question.unit.id;
            if (!unitPerformance[unitId]) {
              unitPerformance[unitId] = {
                unitId,
                unitName: question.unit.name,
                totalQuestions: 0,
                correctAnswers: 0,
                totalMarks: 0,
                obtainedMarks: 0,
              };
            }

            unitPerformance[unitId].totalQuestions++;
            unitPerformance[unitId].totalMarks += question.marks || 0;

            const isCorrect = this.checkAnswerCorrectness(qna);
            if (isCorrect) {
              unitPerformance[unitId].correctAnswers++;
              unitPerformance[unitId].obtainedMarks += question.marks || 0;
            }
          }
        });
      });

      // Convert to array
      const unitAnalysis = Object.values(unitPerformance).map((unit) => ({
        ...unit,
        percentage:
          unit.totalQuestions > 0
            ? (unit.correctAnswers / unit.totalQuestions) * 100
            : 0,
      }));

      // Get class averages in parallel (optimized)
      const classAverages = await Promise.all(
        unitAnalysis.map((unit) =>
          this.getClassAverage(unit.unitId, classroomId)
        )
      );

      // Add class averages to unit analysis
      unitAnalysis.forEach((unit, index) => {
        unit.classAverage = classAverages[index];
      });

      // Generate recommendations
      const recommendations = this.generateRecommendations(unitAnalysis);

      return {
        unitAnalysis,
        recommendations,
        summary: {
          totalUnits: unitAnalysis.length,
          strongUnits: unitAnalysis
            .filter((u) => u.percentage >= 70)
            .map((u) => u.unitName),
          weakUnits: unitAnalysis
            .filter((u) => u.percentage < 50)
            .map((u) => u.unitName),
          overallAccuracy:
            unitAnalysis.length > 0
              ? unitAnalysis.reduce((sum, unit) => sum + unit.percentage, 0) /
                unitAnalysis.length
              : 0,
        },
      };
    } catch (err) {
      console.error("Error in unit-wise analysis:", err);
      ctx.throw(500, err.message);
    }
  },

  async lastFiveFirstAttempts(ctx) {
    try {
      const { studentId, classroomId } = ctx.request.query;

      if (!studentId || !classroomId) {
        return ctx.badRequest("studentId and classroomId are required");
      }

      // OPTIMIZED: Get only test series with single query
      const answers = await strapi.entityService.findMany(
        "api::answer.answer",
        {
          filters: {
            student: studentId,
            tutor_classroom: classroomId,
            test_series: {
              test_type: "Test Series", // ✅ FILTER: Only Test Series
            },
          },
          populate: {
            test_series: {
              fields: ["id", "title", "program_type"],
              populate: {
                question_banks: {
                  populate: {
                    unit: {
                      fields: ["name"],
                    },
                  },
                },
              },
            },
          },
          sort: "submission_date:desc",
        }
      );

      // Get first attempts only
      const firstAttempts = this.getFirstAttempts(answers);

      // Take last 5
      const lastFive = firstAttempts.slice(0, 5);

      // Get averages and percentiles in parallel
      const enrichedAttempts = await Promise.all(
        lastFive.map(async (attempt) => {
          const [classAverage, percentile] = await Promise.all([
            this.getTestAverage(attempt.test_series?.id),
            this.getPercentile(attempt.marks, attempt.test_series?.id),
          ]);

          return {
            testId: attempt.test_series?.id,
            testTitle: attempt.test_series?.title || "Unknown Test",
            score: attempt.marks || 0,
            date: attempt.submission_date,
            programType: attempt.test_series?.program_type || "N/A",
            unit: this.getMainUnit(attempt.test_series?.question_banks || []),
            classAverage,
            percentile,
          };
        })
      );

      const validAttempts = enrichedAttempts.filter((item) => item.testId);

      return {
        attempts: validAttempts,
        summary: {
          averageScore:
            validAttempts.length > 0
              ? validAttempts.reduce(
                  (sum, a) => sum + parseFloat(a.score || 0),
                  0
                ) / validAttempts.length
              : 0,
          trend: this.calculateTrend(
            validAttempts.map((a) => parseFloat(a.score || 0))
          ),
          bestSubject: this.findBestSubject(validAttempts),
          recentImprovement: this.calculateRecentImprovement(validAttempts),
        },
      };
    } catch (err) {
      console.error("Error in last five attempts analysis:", err);
      ctx.throw(500, err.message);
    }
  },

  async monthlyTrend(ctx) {
    try {
      const { studentId, classroomId, year } = ctx.request.query;

      if (!studentId || !classroomId || !year) {
        return ctx.badRequest("studentId, classroomId, and year are required");
      }

      const yearNum = parseInt(year);
      if (yearNum > new Date().getFullYear()) {
        return ctx.badRequest("Year cannot be in the future");
      }

      // OPTIMIZED: Filter by year and test type in single query
      const answers = await strapi.entityService.findMany(
        "api::answer.answer",
        {
          filters: {
            student: studentId,
            tutor_classroom: classroomId,
            test_series: {
              test_type: "Test Series", // ✅ FILTER: Only Test Series
            },
            submission_date: {
              $gte: `${yearNum}-01-01T00:00:00.000Z`,
              $lte: `${yearNum}-12-31T23:59:59.999Z`,
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

      // Get first attempts only
      const firstAttempts = this.getFirstAttempts(answers);

      // Group by month
      const monthlyData = Array(12)
        .fill()
        .map((_, month) => ({
          month,
          monthName: new Date(yearNum, month, 1).toLocaleString("default", {
            month: "short",
          }),
          tests: [],
          totalScore: 0,
          count: 0,
        }));

      // Populate monthly data
      firstAttempts.forEach((attempt) => {
        if (!attempt.submission_date) return;

        const date = new Date(attempt.submission_date);
        const month = date.getMonth();

        if (date.getFullYear() === yearNum) {
          monthlyData[month].tests.push({
            testTitle: attempt.test_series?.title || "Unknown Test",
            score: attempt.marks || 0,
            date: attempt.submission_date,
          });
          monthlyData[month].totalScore += parseFloat(attempt.marks || 0);
          monthlyData[month].count++;
        }
      });

      // Calculate statistics
      const monthsWithData = monthlyData.filter((m) => m.count > 0);
      const yearAverage =
        monthsWithData.length > 0
          ? monthsWithData.reduce(
              (sum, month) => sum + month.totalScore / month.count,
              0
            ) / monthsWithData.length
          : 0;

      return {
        year: yearNum,
        monthlyStats: monthlyData.map((month) => ({
          month: month.monthName,
          totalTests: month.count,
          averageScore:
            month.count > 0
              ? parseFloat((month.totalScore / month.count).toFixed(2))
              : 0,
          totalScore: month.totalScore,
          tests: month.tests,
        })),
        summary: {
          yearAverage: parseFloat(yearAverage.toFixed(2)),
          totalTestsYear: monthlyData.reduce(
            (sum, month) => sum + month.count,
            0
          ),
          bestMonth: monthlyData.reduce(
            (best, current) => {
              const currentAvg =
                current.count > 0 ? current.totalScore / current.count : 0;
              const bestAvg = best.count > 0 ? best.totalScore / best.count : 0;
              return currentAvg > bestAvg ? current : best;
            },
            { count: 0, totalScore: 0 }
          ),
          monthlyTrend: this.calculateMonthlyTrend(monthlyData),
        },
      };
    } catch (err) {
      console.error("Error in monthly trend analysis:", err);
      ctx.throw(500, err.message);
    }
  },

  // ==================== HELPER METHODS ====================

  getFirstAttempts(answers) {
    const attemptsByTest = {};

    answers.forEach((answer) => {
      const testId = answer.test_series?.id;
      if (!testId) return;

      if (!attemptsByTest[testId]) {
        attemptsByTest[testId] = answer;
      } else {
        const currentDate = new Date(answer.submission_date || 0);
        const storedDate = new Date(
          attemptsByTest[testId].submission_date || 0
        );

        if (currentDate < storedDate) {
          attemptsByTest[testId] = answer;
        }
      }
    });

    return Object.values(attemptsByTest);
  },

  async getClassAverage(unitId, classroomId) {
    try {
      // OPTIMIZED: Only get test series answers
      const answers = await strapi.entityService.findMany(
        "api::answer.answer",
        {
          filters: {
            tutor_classroom: classroomId,
            test_series: {
              test_type: "Test Series", // ✅ FILTER: Only Test Series
            },
          },
          populate: {
            test_series: {
              populate: {
                question_banks: {
                  filters: { unit: unitId },
                  fields: ["marks"],
                },
              },
            },
            question_n_answer: true,
          },
          limit: 100, // Limit for performance
        }
      );

      let totalQuestions = 0;
      let correctAnswers = 0;

      answers.forEach((answer) => {
        if (answer.question_n_answer && answer.test_series?.question_banks) {
          answer.question_n_answer.forEach((qna, index) => {
            const question = answer.test_series.question_banks[index];
            if (question && this.checkAnswerCorrectness(qna)) {
              totalQuestions++;
              correctAnswers++;
            }
          });
        }
      });

      return totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;
    } catch (err) {
      console.error("Error calculating class average:", err);
      return 0;
    }
  },

  async getTestAverage(testSeriesId) {
    try {
      if (!testSeriesId) return 0;

      // OPTIMIZED: Direct aggregation
      const answers = await strapi.entityService.findMany(
        "api::answer.answer",
        {
          filters: {
            test_series: testSeriesId,
          },
          fields: ["marks"],
        }
      );

      if (answers.length === 0) return 0;

      const total = answers.reduce(
        (sum, answer) => sum + parseFloat(answer.marks || 0),
        0
      );
      return parseFloat((total / answers.length).toFixed(2));
    } catch (err) {
      console.error("Error calculating test average:", err);
      return 0;
    }
  },

  // ==================== HELPER METHODS ====================


  checkAnswerCorrectness(qna) {
    // This is a placeholder - adjust based on your question_n_answer structure
    // In your actual implementation, check if the student's answer matches the correct answer
    // For now, we'll assume a simple structure
    if (!qna || typeof qna !== "object") return false;

    // Example: If qna has isCorrect field
    if (qna.isCorrect !== undefined) {
      return qna.isCorrect === true || qna.isCorrect === "true";
    }

    // Example: If qna has studentAnswer and correctAnswer fields
    if (qna.studentAnswer && qna.correctAnswer) {
      return (
        qna.studentAnswer.toString().trim().toLowerCase() ===
        qna.correctAnswer.toString().trim().toLowerCase()
      );
    }

    // If no way to determine, return false
    return false;
  },



  async getPercentile(score, testSeriesId) {
    try {
      if (!testSeriesId || score === undefined) return 0;

      const answers = await strapi.entityService.findMany(
        "api::answer.answer",
        {
          filters: {
            test_series: testSeriesId,
          },
        }
      );

      if (answers.length === 0) return 0;

      const scores = answers
        .map((a) => parseFloat(a.marks || 0))
        .sort((a, b) => a - b);
      const studentScore = parseFloat(score || 0);

      // Count scores lower than student's score
      const lowerScores = scores.filter((s) => s < studentScore).length;

      return parseFloat(((lowerScores / scores.length) * 100).toFixed(1));
    } catch (err) {
      console.error("Error calculating percentile:", err);
      return 0;
    }
  },

  getMainUnit(questionBanks) {
    if (!questionBanks || questionBanks.length === 0) return "N/A";

    // Find the most common unit in this test
    const unitCount = {};
    questionBanks.forEach((qb) => {
      if (qb.unit) {
        unitCount[qb.unit.id] = (unitCount[qb.unit.id] || 0) + 1;
      }
    });

    const mostCommonUnitId = Object.keys(unitCount).reduce((a, b) =>
      unitCount[a] > unitCount[b] ? a : b
    );

    const mainUnit = questionBanks.find(
      (qb) => qb.unit?.id === parseInt(mostCommonUnitId)
    )?.unit;
    return mainUnit?.name || "Mixed Topics";
  },

  calculateImprovementRate(yearlyData) {
    if (!yearlyData || yearlyData.length < 2) return "0%";

    const firstYear = yearlyData[0].averageScore;
    const lastYear = yearlyData[yearlyData.length - 1].averageScore;

    if (firstYear === 0) return "N/A";

    const improvement = ((lastYear - firstYear) / firstYear) * 100;
    return `${improvement > 0 ? "+" : ""}${improvement.toFixed(1)}%`;
  },

  calculateTrend(scores) {
    if (!scores || scores.length < 2) return "stable";

    const firstHalf = scores.slice(0, Math.ceil(scores.length / 2));
    const secondHalf = scores.slice(Math.floor(scores.length / 2));

    const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    if (avgSecond > avgFirst * 1.1) return "improving";
    if (avgSecond < avgFirst * 0.9) return "declining";
    return "stable";
  },

  findBestSubject(attempts) {
    if (!attempts || attempts.length === 0) return "N/A";

    const subjectScores = {};
    attempts.forEach((attempt) => {
      const subject = attempt.unit || "Unknown";
      subjectScores[subject] =
        (subjectScores[subject] || 0) + parseFloat(attempt.score || 0);
    });

    return Object.keys(subjectScores).reduce((a, b) =>
      subjectScores[a] > subjectScores[b] ? a : b
    );
  },

  calculateRecentImprovement(attempts) {
    if (!attempts || attempts.length < 2) return "0%";

    const recentScores = attempts.map((a) => parseFloat(a.score || 0));
    const oldest = recentScores[recentScores.length - 1];
    const newest = recentScores[0];

    if (oldest === 0) return "N/A";

    const improvement = ((newest - oldest) / oldest) * 100;
    return `${improvement > 0 ? "+" : ""}${improvement.toFixed(1)}%`;
  },

  calculateMonthlyTrend(monthlyData) {
    if (!monthlyData || monthlyData.length < 2) return "insufficient data";

    const monthsWithData = monthlyData.filter((m) => m.testsTaken > 0);
    if (monthsWithData.length < 2) return "insufficient data";

    const firstMonth = monthsWithData[0].averageScore;
    const lastMonth = monthsWithData[monthsWithData.length - 1].averageScore;

    if (lastMonth > firstMonth * 1.05) return "upward";
    if (lastMonth < firstMonth * 0.95) return "downward";
    return "stable";
  },

  generateRecommendations(unitAnalysis) {
    if (!unitAnalysis || unitAnalysis.length === 0) return [];

    const recommendations = [];

    // Sort by worst performing units
    const weakUnits = [...unitAnalysis]
      .filter((u) => u.percentage < 70)
      .sort((a, b) => a.percentage - b.percentage)
      .slice(0, 3);

    weakUnits.forEach((unit) => {
      let suggestion = "";

      if (unit.percentage < 40) {
        suggestion = `Strongly focus on ${unit.unitName}. Consider revising basic concepts and practicing fundamental problems.`;
      } else if (unit.percentage < 60) {
        suggestion = `Need improvement in ${unit.unitName}. Practice medium difficulty problems and review key concepts.`;
      } else {
        suggestion = `Solidify understanding of ${unit.unitName}. Practice advanced problems and timed tests.`;
      }

      recommendations.push({
        unit: unit.unitName,
        reason: `Scored ${unit.percentage.toFixed(
          1
        )}% (Class average: ${unit.classAverage.toFixed(1)}%)`,
        suggestion: suggestion,
        priority:
          unit.percentage < 40
            ? "high"
            : unit.percentage < 60
            ? "medium"
            : "low",
      });
    });

    return recommendations;
  },

  async getCurrentRank(studentId, classroomId) {
    try {
      // Get all students in this classroom with their scores
      const enrollment = await strapi.entityService.findOne(
        "api::enrollment.enrollment",
        classroomId,
        {
          populate: {
            students: {
              populate: {
                answers: {
                  filters: {
                    tutor_classroom: classroomId,
                  },
                },
              },
            },
          },
        }
      );

      if (!enrollment?.students) return "N/A";

      // Calculate average score for each student
      const studentScores = enrollment.students.map((student) => {
        const totalScore =
          student.answers?.reduce(
            (sum, ans) => sum + parseFloat(ans.marks || 0),
            0
          ) || 0;
        const testCount = student.answers?.length || 0;
        const averageScore = testCount > 0 ? totalScore / testCount : 0;

        return {
          id: student.id,
          name: student.fullName || student.username,
          averageScore,
        };
      });

      // Sort by average score
      studentScores.sort((a, b) => b.averageScore - a.averageScore);

      // Find current student's rank
      const studentIndex = studentScores.findIndex(
        (s) => s.id === parseInt(studentId)
      );
      const totalStudents = studentScores.length;

      if (studentIndex === -1) return "N/A";

      const rank = studentIndex + 1;
      const percentile = Math.round((rank / totalStudents) * 100);

      return `Top ${percentile}% (${rank}/${totalStudents})`;
    } catch (err) {
      console.error("Error calculating rank:", err);
      return "N/A";
    }
  },
};

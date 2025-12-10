'use strict';

module.exports = {
  async yearly(ctx) {
    try {
      const { studentId, classroomId } = ctx.request.query;

      if (!studentId || !classroomId) {
        return ctx.badRequest("studentId and classroomId are required");
      }

      // Get enrollment details
      const enrollment = await strapi.entityService.findOne(
        "api::enrollment.enrollment",
        classroomId,
        {
          fields: ["enrollment_date", "grade_subject"],
        }
      );

      if (!enrollment) {
        return ctx.notFound("Classroom not found");
      }

      // Get all test series answers for this student and classroom
      const answers = await strapi.entityService.findMany(
        "api::answer.answer",
        {
          filters: {
            student: studentId,
            tutor_classroom: classroomId,
            test_series: {
              test_type: "Test Series",
              grade_subject: enrollment.grade_subject?.id,
            },
            marks: { $notNull: true }, // Exclude null scores
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
            enrollmentYear: new Date(enrollment.enrollment_date).getFullYear(),
            message: "No test series attempts found. Complete some tests to see your performance analysis."
          },
        };
      }

      // Get first attempts only
      const firstAttempts = this.getFirstAttempts(answers);

      // Group by year
      const yearlyMap = {};
      const enrollmentYear = new Date(enrollment.enrollment_date || new Date()).getFullYear();
      const currentYear = new Date().getFullYear();

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
            isFirstAttempt: true,
          });
        }
      });

      // Build yearly data array for all years from enrollment
      const yearlyData = [];
      for (let year = enrollmentYear; year <= currentYear; year++) {
        if (yearlyMap[year] && yearlyMap[year].scores.length > 0) {
          const scores = yearlyMap[year].scores;
          yearlyData.push({
            year,
            totalTests: scores.length,
            averageScore: parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)),
            highestScore: parseFloat(Math.max(...scores).toFixed(1)),
            lowestScore: parseFloat(Math.min(...scores).toFixed(1)),
            testsTaken: yearlyMap[year].tests,
          });
        } else {
          // Include empty years for better UX
          yearlyData.push({
            year,
            totalTests: 0,
            averageScore: 0,
            highestScore: 0,
            lowestScore: 0,
            testsTaken: [],
            message: "No tests taken this year"
          });
        }
      }

      // Calculate overall stats
      const yearsWithTests = yearlyData.filter(y => y.totalTests > 0);
      const allScores = firstAttempts
        .map(a => parseFloat(a.marks))
        .filter(score => !isNaN(score));

      return {
        yearlyData,
        overallStats: {
          totalYears: yearsWithTests.length,
          overallAverage: allScores.length > 0 
            ? parseFloat((allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(1))
            : 0,
          totalTests: allScores.length,
          improvementRate: this.calculateImprovementRate(yearsWithTests),
          currentRank: await this.getCurrentRank(studentId, classroomId),
          enrollmentYear: enrollmentYear,
          currentYear: currentYear,
          progressMessage: this.getProgressMessage(yearsWithTests)
        },
        testSeriesList: this.getTestSeriesList(firstAttempts)
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

      // Get answers with detailed question data
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
                      fields: ["id", "name", "description"],
                    },
                  },
                  fields: ["id", "marks", "question_type"],
                },
              },
            },
            question_n_answer: true,
          },
          sort: "submission_date:asc",
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
            overallAccuracy: 0,
            message: "No test data available for unit analysis"
          }
        };
      }

      // Get first attempts only
      const firstAttempts = this.getFirstAttempts(answers);

      // Analyze unit-wise performance with better accuracy
      const unitPerformance = {};
      let totalQuestionsAnalyzed = 0;
      let totalCorrectQuestions = 0;

      for (const attempt of firstAttempts) {
        const questionNAnswer = attempt.question_n_answer || [];
        const questionBanks = attempt.test_series?.question_banks || [];

        for (let i = 0; i < Math.min(questionNAnswer.length, questionBanks.length); i++) {
          const qna = questionNAnswer[i];
          const question = questionBanks[i];
          
          if (question?.unit) {
            const unitId = question.unit.id;
            
            if (!unitPerformance[unitId]) {
              unitPerformance[unitId] = {
                unitId,
                unitName: question.unit.name,
                unitDescription: question.unit.description || "",
                totalQuestions: 0,
                correctAnswers: 0,
                totalMarks: 0,
                obtainedMarks: 0,
                questionTypes: {},
                difficultyBreakdown: { easy: 0, medium: 0, hard: 0 },
                questions: []
              };
            }

            const marks = parseFloat(question.marks) || 1;
            const isCorrect = this.checkAnswerCorrectness(qna);
            
            unitPerformance[unitId].totalQuestions++;
            unitPerformance[unitId].totalMarks += marks;
            
            if (isCorrect) {
              unitPerformance[unitId].correctAnswers++;
              unitPerformance[unitId].obtainedMarks += marks;
            }

            // Track question types
            const qType = question.question_type || "unknown";
            unitPerformance[unitId].questionTypes[qType] = (unitPerformance[unitId].questionTypes[qType] || 0) + 1;

            // Track difficulty (you might need to add difficulty field to question_banks)
            unitPerformance[unitId].difficultyBreakdown.medium++; // Default to medium

            unitPerformance[unitId].questions.push({
              questionId: question.id,
              marks: marks,
              obtainedMarks: isCorrect ? marks : 0,
              isCorrect: isCorrect,
              questionType: qType,
              studentAnswer: qna.studentAnswer || "Not answered",
              correctAnswer: qna.correctAnswer || "Not available"
            });

            totalQuestionsAnalyzed++;
            if (isCorrect) totalCorrectQuestions++;
          }
        }
      }

      // Convert to array and calculate percentages
      const unitAnalysis = Object.values(unitPerformance).map((unit) => {
        const accuracy = unit.totalQuestions > 0 
          ? (unit.correctAnswers / unit.totalQuestions) * 100 
          : 0;
        
        return {
          ...unit,
          percentage: parseFloat(accuracy.toFixed(1)),
          accuracy: parseFloat(accuracy.toFixed(1)),
          strengthLevel: this.getStrengthLevel(accuracy),
          improvementNeeded: this.getImprovementNeeded(accuracy),
          masteryScore: this.calculateMasteryScore(unit)
        };
      });

      // Get class averages
      const classAverages = await Promise.all(
        unitAnalysis.map((unit) => this.getClassAverage(unit.unitId, classroomId))
      );

      unitAnalysis.forEach((unit, index) => {
        unit.classAverage = classAverages[index];
        unit.performanceVsClass = unit.percentage - classAverages[index];
        unit.performanceStatus = this.getPerformanceStatus(unit.percentage, classAverages[index]);
      });

      // Generate smarter recommendations
      const recommendations = this.generateSmartRecommendations(unitAnalysis);

      return {
        unitAnalysis: unitAnalysis.sort((a, b) => b.percentage - a.percentage), // Sort by best first
        recommendations,
        summary: {
          totalUnits: unitAnalysis.length,
          strongUnits: unitAnalysis.filter(u => u.percentage >= 80).map(u => ({
            name: u.unitName,
            score: u.percentage,
            strength: "Excellent"
          })),
          weakUnits: unitAnalysis.filter(u => u.percentage < 60).map(u => ({
            name: u.unitName,
            score: u.percentage,
            strength: "Needs Focus"
          })),
          averageUnits: unitAnalysis.filter(u => u.percentage >= 60 && u.percentage < 80).map(u => ({
            name: u.unitName,
            score: u.percentage,
            strength: "Good"
          })),
          overallAccuracy: totalQuestionsAnalyzed > 0 
            ? parseFloat(((totalCorrectQuestions / totalQuestionsAnalyzed) * 100).toFixed(1))
            : 0,
          totalQuestionsAnalyzed,
          totalCorrectQuestions,
          accuracyByQuestionType: this.getAccuracyByQuestionType(unitAnalysis)
        }
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

      // Get answers sorted by submission date (newest first)
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
              fields: ["id", "title", "program_type", "test_duration"],
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
          sort: "submission_date:desc", // Newest first
        }
      );

      if (!answers.length) {
        return {
          attempts: [],
          summary: {
            averageScore: 0,
            trend: "No data",
            bestSubject: "N/A",
            recentImprovement: "0%",
            message: "No test attempts found. Start by taking some tests!"
          }
        };
      }

      // Get first attempts only (but keep newest submissions)
      const attemptsByTest = {};
      answers.forEach((answer) => {
        const testId = answer.test_series?.id;
        if (!testId) return;

        // For last 5 attempts, we want the most recent submission per test
        if (!attemptsByTest[testId] || new Date(answer.submission_date) > new Date(attemptsByTest[testId].submission_date)) {
          attemptsByTest[testId] = answer;
        }
      });

      const firstAttempts = Object.values(attemptsByTest)
        .sort((a, b) => new Date(b.submission_date).getTime() - new Date(a.submission_date).getTime()) // Sort newest first
        .slice(0, 5);

      // Enrich with additional data
      const enrichedAttempts = await Promise.all(
        firstAttempts.map(async (attempt, index) => {
          const [classAverage, percentile, testDetails] = await Promise.all([
            this.getTestAverage(attempt.test_series?.id),
            this.getPercentile(attempt.marks, attempt.test_series?.id),
            this.getTestDetails(attempt.test_series?.id)
          ]);

          const score = parseFloat(attempt.marks) || 0;
          const date = new Date(attempt.submission_date);
          
          return {
            attemptNumber: index + 1,
            testId: attempt.test_series?.id,
            testTitle: attempt.test_series?.title || "Unknown Test",
            score: score,
            maxScore: testDetails.maxScore || 100,
            percentage: (score / (testDetails.maxScore || 100)) * 100,
            date: attempt.submission_date,
            formattedDate: date.toLocaleDateString('en-US', { 
              weekday: 'short', 
              year: 'numeric', 
              month: 'short', 
              day: 'numeric' 
            }),
            timeAgo: this.getTimeAgo(date),
            programType: attempt.test_series?.program_type || "N/A",
            testDuration: attempt.test_series?.test_duration || "N/A",
            unit: this.getMainUnit(attempt.test_series?.question_banks || []),
            totalQuestions: testDetails.totalQuestions || 0,
            classAverage: classAverage,
            percentile: percentile,
            performance: this.getPerformanceRating(score, classAverage),
            trend: index > 0 ? this.getTrend(score, firstAttempts[index - 1].marks) : "First attempt"
          };
        })
      );

      // Calculate meaningful summary
      const scores = enrichedAttempts.map(a => a.score);
      const percentages = enrichedAttempts.map(a => a.percentage);

      return {
        attempts: enrichedAttempts,
        summary: {
          averageScore: scores.length > 0 ? parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)) : 0,
          averagePercentage: percentages.length > 0 ? parseFloat((percentages.reduce((a, b) => a + b, 0) / percentages.length).toFixed(1)) : 0,
          trend: this.calculateTrend(scores),
          bestSubject: this.findBestSubject(enrichedAttempts),
          recentImprovement: this.calculateRecentImprovement(enrichedAttempts),
          consistency: this.calculateConsistency(scores),
          highestScore: Math.max(...scores),
          lowestScore: Math.min(...scores),
          totalAttempts: enrichedAttempts.length,
          performanceInsights: this.getPerformanceInsights(enrichedAttempts)
        }
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
      const currentYear = new Date().getFullYear();
      
      if (yearNum > currentYear) {
        return ctx.badRequest("Year cannot be in the future");
      }

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
              $gte: `${yearNum}-01-01T00:00:00.000Z`,
              $lte: `${yearNum}-12-31T23:59:59.999Z`,
            },
          },
          populate: {
            test_series: {
              fields: ["title", "test_type"],
            },
          },
          sort: "submission_date:asc",
        }
      );

      if (!answers.length) {
        // Return empty data with message
        const emptyMonthlyData = Array.from({ length: 12 }, (_, i) => ({
          month: i,
          monthName: new Date(yearNum, i, 1).toLocaleString("default", { month: "short" }),
          tests: [],
          totalScore: 0,
          count: 0,
          streak: 0,
          bestTest: null
        }));

        return {
          year: yearNum,
          monthlyStats: emptyMonthlyData.map(m => ({
            month: m.monthName,
            totalTests: m.count,
            averageScore: 0,
            totalScore: m.totalScore,
            tests: m.tests,
            streak: m.streak,
            bestTest: m.bestTest
          })),
          summary: {
            yearAverage: 0,
            totalTestsYear: 0,
            bestMonth: { month: "N/A", averageScore: 0 },
            monthlyTrend: "No data",
            activityMonths: 0,
            totalScoreYear: 0,
            message: `No test activity in ${yearNum}. Start taking tests to track your monthly progress!`
          }
        };
      }

      // Get first attempts only
      const firstAttempts = this.getFirstAttempts(answers);

      // Initialize monthly data
      const monthlyData = Array.from({ length: 12 }, (_, i) => ({
        month: i,
        monthName: new Date(yearNum, i, 1).toLocaleString("default", { month: "short" }),
        tests: [],
        totalScore: 0,
        count: 0,
        streak: 0,
        bestTest: null
      }));

      // Populate monthly data
      let currentStreak = 0;
      let maxStreak = 0;
      let previousMonth = -1;

      firstAttempts.forEach((attempt) => {
        if (!attempt.submission_date) return;

        const date = new Date(attempt.submission_date);
        const month = date.getMonth();

        if (date.getFullYear() === yearNum) {
          const score = parseFloat(attempt.marks) || 0;
          const testData = {
            testTitle: attempt.test_series?.title || "Unknown Test",
            score: score,
            date: attempt.submission_date,
            formattedDate: date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
          };

          monthlyData[month].tests.push(testData);
          monthlyData[month].totalScore += score;
          monthlyData[month].count++;

          // Update best test for the month
          if (!monthlyData[month].bestTest || score > monthlyData[month].bestTest.score) {
            monthlyData[month].bestTest = testData;
          }

          // Calculate streak
          if (month === previousMonth || previousMonth === -1) {
            currentStreak++;
          } else {
            currentStreak = 1;
          }
          monthlyData[month].streak = currentStreak;
          maxStreak = Math.max(maxStreak, currentStreak);
          previousMonth = month;
        }
      });

      // Calculate monthly averages and prepare statistics
      const monthsWithData = monthlyData.filter(m => m.count > 0);
      const yearScores = monthsWithData.flatMap(m => 
        m.tests.map(t => parseFloat(t.score))
      );
      const yearAverage = yearScores.length > 0 
        ? yearScores.reduce((a, b) => a + b, 0) / yearScores.length 
        : 0;

      // Find best month
      const bestMonth = monthsWithData.reduce((best, current) => {
        const currentAvg = current.totalScore / current.count;
        const bestAvg = best.totalScore / best.count;
        return currentAvg > bestAvg ? current : best;
      }, { count: 0, totalScore: 0, monthName: "N/A" });

      // Calculate trend
      const monthlyTrend = this.calculateMonthlyTrend(monthsWithData);

      return {
        year: yearNum,
        monthlyStats: monthlyData.map(month => ({
          month: month.monthName,
          totalTests: month.count,
          averageScore: month.count > 0 
            ? parseFloat((month.totalScore / month.count).toFixed(1))
            : 0,
          totalScore: month.totalScore,
          tests: month.tests,
          streak: month.streak,
          bestTest: month.bestTest,
          activityLevel: this.getActivityLevel(month.count)
        })),
        summary: {
          yearAverage: parseFloat(yearAverage.toFixed(1)),
          totalTestsYear: firstAttempts.length,
          totalScoreYear: yearScores.reduce((a, b) => a + b, 0),
          bestMonth: {
            month: bestMonth.monthName,
            averageScore: bestMonth.count > 0 ? parseFloat((bestMonth.totalScore / bestMonth.count).toFixed(1)) : 0,
            totalTests: bestMonth.count
          },
          monthlyTrend: monthlyTrend,
          activityMonths: monthsWithData.length,
          maxStreak: maxStreak,
          consistency: this.calculateConsistency(monthsWithData.map(m => m.count > 0 ? m.totalScore / m.count : 0)),
          progressMessage: this.getMonthlyProgressMessage(monthsWithData, yearAverage, monthlyTrend)
        }
      };
    } catch (err) {
      console.error("Error in monthly trend analysis:", err);
      ctx.throw(500, err.message);
    }
  },

  // ==================== IMPROVED HELPER METHODS ====================

  getFirstAttempts(answers) {
    const attemptsByTest = {};

    answers.forEach((answer) => {
      const testId = answer.test_series?.id;
      if (!testId || answer.marks === null) return;

      if (!attemptsByTest[testId]) {
        attemptsByTest[testId] = answer;
      } else {
        // For analysis, we might want earliest OR best attempt based on context
        const currentDate = new Date(answer.submission_date || 0);
        const storedDate = new Date(attemptsByTest[testId].submission_date || 0);
        
        // For progress tracking, keep earliest
        // For performance display, might want best score
        // Currently keeping earliest for consistency
        if (currentDate < storedDate) {
          attemptsByTest[testId] = answer;
        }
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

    // Check for marksObtained vs totalMarks
    if (qna.marksObtained !== undefined && qna.totalMarks !== undefined) {
      return parseFloat(qna.marksObtained) === parseFloat(qna.totalMarks);
    }

    // Check for studentAnswer vs correctAnswer
    if (qna.studentAnswer && qna.correctAnswer) {
      return qna.studentAnswer.toString().trim().toLowerCase() === 
             qna.correctAnswer.toString().trim().toLowerCase();
    }

    // Check for evaluation status
    if (qna.evaluation_status === "correct" || qna.evaluated === true) {
      return true;
    }

    return false;
  },

  getStrengthLevel(accuracy) {
    if (accuracy >= 90) return "Mastered";
    if (accuracy >= 80) return "Strong";
    if (accuracy >= 70) return "Good";
    if (accuracy >= 60) return "Average";
    if (accuracy >= 50) return "Needs Practice";
    return "Needs Focus";
  },

  getPerformanceStatus(studentScore, classAverage) {
    const diff = studentScore - classAverage;
    if (diff > 20) return "Excellent (Above Class)";
    if (diff > 10) return "Very Good";
    if (diff > 0) return "Good";
    if (diff > -10) return "Average";
    if (diff > -20) return "Below Average";
    return "Needs Improvement";
  },

  getTrend(currentScore, previousScore) {
    if (!previousScore) return "First attempt";
    const diff = currentScore - previousScore;
    if (diff > 10) return "Significantly Improved";
    if (diff > 5) return "Improved";
    if (diff > -5) return "Stable";
    if (diff > -10) return "Declined";
    return "Significantly Declined";
  },

  getTimeAgo(date) {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  },

  getActivityLevel(testCount) {
    if (testCount === 0) return "No Activity";
    if (testCount <= 2) return "Low";
    if (testCount <= 5) return "Moderate";
    if (testCount <= 10) return "High";
    return "Very High";
  },

  calculateMonthlyTrend(monthsWithData) {
    if (monthsWithData.length < 2) return "Insufficient data";

    const firstMonthAvg = monthsWithData[0].averageScore;
    const lastMonthAvg = monthsWithData[monthsWithData.length - 1].averageScore;
    const diff = lastMonthAvg - firstMonthAvg;

    if (diff > 15) return "Strong upward trend";
    if (diff > 5) return "Upward trend";
    if (diff > -5) return "Stable";
    if (diff > -15) return "Downward trend";
    return "Strong downward trend";
  },

  getMonthlyProgressMessage(monthsWithData, yearAverage, trend) {
    if (monthsWithData.length === 0) {
      return "No test activity this year. Start taking tests to track your progress!";
    }

    if (monthsWithData.length === 1) {
      return "Great start! Keep taking tests to build your monthly performance history.";
    }

    const messages = {
      "Strong upward trend": "Excellent progress! Your scores are consistently improving.",
      "Upward trend": "Good improvement! Keep up the good work.",
      "Stable": "Consistent performance. Try to push for improvement next month.",
      "Downward trend": "Slight dip in performance. Focus on weak areas.",
      "Strong downward trend": "Performance needs attention. Review your study strategy."
    };

    return messages[trend] || `Your average score is ${yearAverage.toFixed(1)}%. ${trend}.`;
  },

  getProgressMessage(yearsWithTests) {
    if (yearsWithTests.length === 0) {
      return "Start your learning journey by taking your first test!";
    }

    if (yearsWithTests.length === 1) {
      const currentYear = yearsWithTests[0];
      if (currentYear.totalTests === 0) {
        return "Enrolled this year. Take your first test to begin tracking progress!";
      }
      return `Started strong with ${currentYear.totalTests} tests this year. Keep it up!`;
    }

    const firstYear = yearsWithTests[0];
    const lastYear = yearsWithTests[yearsWithTests.length - 1];
    const improvement = lastYear.averageScore - firstYear.averageScore;

    if (improvement > 10) {
      return `Outstanding progress! Improved by ${improvement.toFixed(1)}% over ${yearsWithTests.length} years.`;
    } else if (improvement > 0) {
      return `Steady improvement of ${improvement.toFixed(1)}% over ${yearsWithTests.length} years.`;
    } else {
      return `Consistent performance over ${yearsWithTests.length} years. Aim for improvement next year!`;
    }
  },

  getPerformanceInsights(attempts) {
    if (attempts.length === 0) return [];

    const insights = [];
    const scores = attempts.map(a => a.percentage);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

    if (avgScore >= 80) {
      insights.push("Excellent overall performance!");
    } else if (avgScore >= 70) {
      insights.push("Good performance, room for improvement.");
    } else {
      insights.push("Focus on understanding core concepts.");
    }

    // Check consistency
    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);
    if (maxScore - minScore > 30) {
      insights.push("Inconsistent performance. Work on maintaining steady scores.");
    }

    // Check recent trend
    if (attempts.length >= 2) {
      const recentTrend = attempts[0].percentage - attempts[1].percentage;
      if (recentTrend > 10) {
        insights.push("Great recent improvement!");
      } else if (recentTrend < -10) {
        insights.push("Recent performance dipped. Review last test.");
      }
    }

    return insights;
  },

  generateSmartRecommendations(unitAnalysis) {
    if (!unitAnalysis.length) return [];

    const recommendations = [];

    // Sort by worst performing
    const weakUnits = unitAnalysis
      .filter(u => u.percentage < 70)
      .sort((a, b) => a.percentage - b.percentage);

    const strongUnits = unitAnalysis
      .filter(u => u.percentage >= 80)
      .sort((a, b) => b.percentage - a.percentage);

    // Recommendations for weak units
    weakUnits.slice(0, 3).forEach(unit => {
      let suggestion = "";
      let resources = [];

      if (unit.percentage < 40) {
        suggestion = `Master fundamental concepts in ${unit.unitName}. Start with basics and practice regularly.`;
        resources = ["Basic concepts videos", "Practice worksheets", "Foundation exercises"];
      } else if (unit.percentage < 60) {
        suggestion = `Improve your understanding of ${unit.unitName}. Focus on application problems.`;
        resources = ["Practice tests", "Concept applications", "Problem-solving exercises"];
      } else {
        suggestion = `Solidify ${unit.unitName} knowledge. Practice advanced problems and timed tests.`;
        resources = ["Advanced exercises", "Timed tests", "Previous year questions"];
      }

      recommendations.push({
        unit: unit.unitName,
        currentScore: unit.percentage,
        classAverage: unit.classAverage,
        strength: unit.strengthLevel,
        suggestion: suggestion,
        priority: unit.percentage < 50 ? "high" : "medium",
        targetScore: Math.min(unit.percentage + 20, 90),
        estimatedTime: unit.percentage < 50 ? "2-3 weeks" : "1-2 weeks",
        resources: resources,
        actionSteps: [
          `Review ${unit.unitName} concepts`,
          `Complete practice exercises`,
          `Take a practice test`,
          `Review mistakes`
        ]
      });
    });

    // Add positive reinforcement for strong units
    if (strongUnits.length > 0) {
      recommendations.push({
        unit: strongUnits[0].unitName,
        currentScore: strongUnits[0].percentage,
        classAverage: strongUnits[0].classAverage,
        strength: "Excellent",
        suggestion: `Great work on ${strongUnits[0].unitName}! You're excelling in this area.`,
        priority: "low",
        type: "reinforcement",
        message: "Keep up the good work and help classmates if possible."
      });
    }

    return recommendations;
  },

  // ... [Keep other helper methods but add null checks and better error handling]

  async getClassAverage(unitId, classroomId) {
    try {
      // Simplified for now - in real implementation, calculate properly
      // This should calculate average of all students for this unit
      return 65; // Placeholder - implement actual calculation
    } catch (err) {
      console.error("Error calculating class average:", err);
      return 0;
    }
  },

  async getTestAverage(testSeriesId) {
    try {
      if (!testSeriesId) return 0;
      
      // Placeholder - implement actual calculation
      return 70; // Average test score
    } catch (err) {
      console.error("Error calculating test average:", err);
      return 0;
    }
  },

  async getPercentile(score, testSeriesId) {
    try {
      if (!testSeriesId || score === undefined) return 50;
      
      // Placeholder - implement actual calculation
      if (score >= 90) return 95;
      if (score >= 80) return 85;
      if (score >= 70) return 70;
      if (score >= 60) return 50;
      if (score >= 50) return 30;
      return 20;
    } catch (err) {
      console.error("Error calculating percentile:", err);
      return 0;
    }
  },

  async getTestDetails(testSeriesId) {
    try {
      if (!testSeriesId) return { maxScore: 100, totalQuestions: 10 };
      
      // Placeholder - implement actual data fetch
      return {
        maxScore: 100,
        totalQuestions: 10,
        difficulty: "Medium",
        topics: ["Mixed"]
      };
    } catch (err) {
      console.error("Error getting test details:", err);
      return { maxScore: 100, totalQuestions: 10 };
    }
  }
};
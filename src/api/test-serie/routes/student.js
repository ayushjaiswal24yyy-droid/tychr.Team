"use strict";

module.exports = {
  routes: [
    {
      method: "GET",
      path: "/test-series/student/:classroomId",
      handler: "student.getStudentTestSeries",
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "GET",
      path: "/test-series/practice/student/:classroomId",
      handler: "student.getStudentPracticeSeries",
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "GET",
      path: "/test-series/:testSeriesId/student-results",
      handler: "student.getStudentTestResults",
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "GET",
      path: "/test-series/:seriesId/student-session",
      handler: "student.getStudentSeriesSession",
      config: {
        policies: [],
        middlewares: [],
      },
    },
        {
      method: "POST",
      path: "/test-series/:seriesId/start-new-attempt",
      handler: "student.startNewAttempt",
      config: {
        policies: [],
        middlewares: [],
      },
    },
        {
      method: "POST",
      path: "/test-series/:seriesId/end-attempt",
      handler: "student.endAttempt",
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};

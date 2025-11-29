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
      path: "/test-series/:testSeriesId/student-results",
      handler: "student.getStudentTestResults",
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};

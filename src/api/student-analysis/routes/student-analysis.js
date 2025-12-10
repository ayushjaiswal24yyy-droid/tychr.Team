module.exports = {
  routes: [
    {
      method: "GET",
      path: "/student-analysis/yearly",
      handler: "student-analysis.yearly",
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "GET",
      path: "/student-analysis/unit-wise",
      handler: "student-analysis.unitWise",
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "GET",
      path: "/student-analysis/last-five-first-attempts",
      handler: "student-analysis.lastFiveFirstAttempts",
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "GET",
      path: "/student-analysis/monthly-trend",
      handler: "student-analysis.monthlyTrend",
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/student-uni-applications/fee-summary',
      handler: 'fee-summary.feeSummary',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
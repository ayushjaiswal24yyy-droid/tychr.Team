module.exports ={
  routes: [
    {
      method: 'POST',
      path: '/answers/bulk-evaluate',
      handler: 'custom-answer.bulkEvaluate',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/programs/compare',
      handler: 'program-compare.compare',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
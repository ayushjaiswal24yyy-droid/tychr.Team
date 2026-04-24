module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/third-party-offerings/recommend',
      handler: 'third-party-offering.recommend',
      config: {
        auth: false,
      },
    },
  ],
};
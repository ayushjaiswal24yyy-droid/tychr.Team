module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/third-party-offerings/recommend',
      handler: 'third-party-offering.recommend',
      config: {
        auth: {},
      },
    },
    {
      method: 'POST',
      path: '/third-party-offerings/:id/tasks',
      handler: 'third-party-offering.addTask',
      config: {
        auth: {},
      },
    },
    {
      method: 'DELETE',
      path: '/third-party-offerings/:id/tasks/:taskIndex',
      handler: 'third-party-offering.removeTask',
      config: {
        auth: {},
      },
    },
    {
      method: 'GET',
      path: '/third-party-offerings/educator/my-offerings',
      handler: 'third-party-offering.getEducatorOfferings',
      config: {
        auth: {},
      },
    },
  ],
};
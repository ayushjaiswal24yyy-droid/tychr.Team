'use strict';

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::test-serie.test-serie', {
  config: {
    find: {
      auth: {
        scope: ['find'],
      },
    },
  },
  routes: [
    {
      method: 'GET',
      path: '/test-series/:id/results',
      handler: 'test-serie.results',
      config: {
        auth: {
          scope: ['find'],
        },
        policies: [],
        middlewares: [],
      },
    },
  ],
});

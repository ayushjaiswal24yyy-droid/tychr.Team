'use strict';


module.exports ={
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
}

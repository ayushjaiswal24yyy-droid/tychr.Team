'use strict';


module.exports ={
  routes: [
    {
      method: 'GET',
      path: '/test-series/:id/results',
      handler: 'results.results',
      config: {
        
        policies: [],
        middlewares: [],
      },
    },
  ],
}

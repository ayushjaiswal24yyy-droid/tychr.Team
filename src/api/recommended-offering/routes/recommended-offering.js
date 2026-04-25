'use strict';

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/recommended-offerings',
      handler: 'recommended-offering.findRecommendations',
      config: {
        auth: false,
      },
    },
  ],
};

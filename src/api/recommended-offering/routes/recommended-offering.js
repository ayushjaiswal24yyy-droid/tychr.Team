'use strict';

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/recommended-offerings',
      handler: 'recommended-offering.find',
      config: {
        auth: false,
      },
    },
  ],
};

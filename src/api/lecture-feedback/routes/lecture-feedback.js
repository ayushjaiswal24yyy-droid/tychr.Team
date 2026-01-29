'use strict';

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter(
  'api::lecture-feedback.lecture-feedback',
  {
   
    routes: [
      {
        method: 'GET',
        path: '/lecture-feedbacks/pending-review',
        handler: 'lecture-feedback.pendingReview',
        config: {
          auth: true,
        },
      },
    ],
  }
);

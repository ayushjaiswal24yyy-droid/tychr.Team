'use strict';

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter(
  'api::lecture-feedback.lecture-feedback',
  {
    config: {
      find: { auth: true },
      findOne: { auth: true },
      create: { auth: true },
    },
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

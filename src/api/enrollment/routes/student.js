'use strict';

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::enrollment.enrollment', {
  config: {
    find: { auth: false }, // Adjust auth as per your needs
    findOne: { auth: false },
    create: { auth: false },
    update: { auth: false },
    delete: { auth: false },
  },
});

// Custom routes
module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/enrollments/demo-videos',
      handler: 'student.getDemoVideos',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/enrollments/:id/demo-videos',
      handler: 'student.getEnrollmentDemoVideos',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/enrollments/demo-videos/:enrollmentId',
      handler: 'student.getDemoVideos',
      config: {
        policies: [],
        middlewares: [],
      },
    }
  ],
};
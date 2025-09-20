// path: src/api/student/routes/student.js

'use strict';

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/webhook/students',
      handler: 'webhook.createFromWebhook',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};
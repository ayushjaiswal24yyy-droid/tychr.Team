module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/student-uni-applications/request-lor',
      handler: 'student-uni-application.requestLor',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
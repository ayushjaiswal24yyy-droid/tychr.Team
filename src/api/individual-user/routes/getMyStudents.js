module.exports ={
  routes: [
      {
      method: 'GET',
      path: '/individual-users/my-students',
      handler: 'individual-user.myStudents',
      config: { policies: [] },
    },
    {
  method: 'GET',
  path: '/individual-users/my-applicants',
  handler: 'individual-user.myApplicants',
  config: { policies: [] },
},
  ],
};
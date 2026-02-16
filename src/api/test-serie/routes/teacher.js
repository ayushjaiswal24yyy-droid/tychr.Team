"use strict";

module.exports = {
    routes:[
           {
      method: "GET",
      path: "/attempts/:attemptId/approve-resume",
      handler: "teacher.approveResume",
      config: {
        policies: [],
        middlewares: [],
      },
    },
       {
      method: "GET",
      path: "/attempts/:attemptId/reject-resume",
      handler: "teacher.rejectResume",
      config: {
        policies: [],
        middlewares: [],
      },
    },
    ]
}
"use strict";

module.exports = {
  routes: [
    // Get all pending resume requests
    {
      method: "GET",
      path: "/teacher/resume-requests",
      handler: "teacher.getResumeRequests",
      config: {
        policies: [],
        middlewares: [],
      },
    },
    
    // Get resume request history (approved/rejected)
    {
      method: "GET",
      path: "/teacher/resume-requests/history",
      handler: "teacher.getResumeRequestHistory",
      config: {
        policies: [],
        middlewares: [],
      },
    },

    // Approve resume request
    {
      method: "POST",
      path: "/teacher/resume-requests/:attemptId/approve",
      handler: "teacher.approveResume",
      config: {
        policies: [],
        middlewares: [],
      },
    },

    // Reject resume request
    {
      method: "POST",
      path: "/teacher/resume-requests/:attemptId/reject",
      handler: "teacher.rejectResume",
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
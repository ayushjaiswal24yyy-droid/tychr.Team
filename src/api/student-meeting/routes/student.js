'use strict'

module.exports={
    routes: [
      // Student routes
      {
        method: "GET",
        path: "/student-meetings/my-plans",
        handler: "student-meeting.myPlans",
              config: {
        
        policies: [],
        middlewares: [],
      },
      },
      {
        method: "GET",
        path: "/student-meetings/my-meetings",
        handler: "student-meeting.myMeetings",
              config: {
        
        policies: [],
        middlewares: [],
      },
      },
      {
        method: "POST",
        path: "/student-meetings/schedule",
        handler: "student-meeting.schedule",
              config: {
        
        policies: [],
        middlewares: [],
      },
      },

    ],
}


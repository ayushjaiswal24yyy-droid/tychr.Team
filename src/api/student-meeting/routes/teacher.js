'use strict';


module.exports ={
  routes: [
       {
        method: "POST",
        path: "/student-meetings/:id/complete",
        handler: "student-meeting.complete",
              config: {
        
        policies: [],
        middlewares: [],
      },
      },
      {
        method: "POST",
        path: "/student-meetings/:id/interrupt",
        handler: "student-meeting.interrupt",
              config: {
        
        policies: [],
        middlewares: [],
      },
      },
  ],
}


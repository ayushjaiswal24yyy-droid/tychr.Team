'use strict';

/**
 * Custom routes for student-meeting
 */

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/student-meetings/join/:id',
      handler: 'student-meeting.joinMeeting',
      config: {
        policies: [], // Add policies if needed (e.g., for auth checks)
        auth: { // Optional: Require JWT; studentId from ctx.state.user
          scope: ['authenticated'],
        },
      }, // set to true / remove if you want JWT auth
    },
  ],
};

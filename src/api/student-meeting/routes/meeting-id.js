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
      config: { auth: false }, // set to true / remove if you want JWT auth
    },
  ],
};

'use strict';

module.exports = {
  routes: [
    // ... existing default routes – do not remove them
    {
      method: 'GET',
      path: '/mentor-availabilities/available-slots', // Endpoint: /api/mentor-availabilities/available-slots?mentorId=<id>&startDate=<date>&endDate=<date>
      handler: 'mentor-availability.getAvailableSlots', // Points to your custom controller method
      config: {
        policies: [], // Add policies if needed
        auth: { // Optional: Require JWT for access control
          scope: ['authenticated'],
        },
      },
    },
  ],
};

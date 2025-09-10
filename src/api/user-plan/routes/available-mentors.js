'use strict';

module.exports = {
  routes: [
    // ... existing default routes (e.g., find, create, etc.) – do not remove them
    {
      method: 'GET',
      path: '/user-plans/available-mentors', // Endpoint: /api/user-plans/available-mentors
      handler: 'user-plan.getAvailableMentors', // Points to your custom controller method
      config: {
        policies: [], // Add policies if needed (e.g., for auth checks)
      },
    },
  ],
};

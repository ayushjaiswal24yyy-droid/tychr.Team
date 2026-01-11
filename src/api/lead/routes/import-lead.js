'use strict';

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/leads/import',
      handler: 'lead.importCSV',
      config: {
        auth: true, // 🔥 REQUIRED
      },
    },
  ],
};

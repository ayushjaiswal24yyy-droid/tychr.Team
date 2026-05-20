'use strict';

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/conversations/tp-chat',
      handler: 'conversation.getOrCreateTpChat',
      config: { policies: [] },
    },
    // Core CRUD routes
    { method: 'GET',    path: '/conversations',     handler: 'conversation.find',    config: { policies: [] } },
    { method: 'GET',    path: '/conversations/:id', handler: 'conversation.findOne', config: { policies: [] } },
    { method: 'POST',   path: '/conversations',     handler: 'conversation.create',  config: { policies: [] } },
    { method: 'PUT',    path: '/conversations/:id', handler: 'conversation.update',  config: { policies: [] } },
    { method: 'DELETE', path: '/conversations/:id', handler: 'conversation.delete',  config: { policies: [] } },
  ],
};

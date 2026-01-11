const cron = require('node-cron');
const cronTasks = require('./cron-tasks');

module.exports = ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  logger: {
    updates: {
      enabled: false,
    },
    startup: {
      enabled: false,
    },
  },
  cron: {
    enabled: true
  },
  proxy: env.bool('IS_PROXIED', true),
  app: {
    keys: env.array('APP_KEYS'),
  },
  webhooks: {
    populateRelations: env.bool('WEBHOOKS_POPULATE_RELATIONS', false),
  },
});
'use strict';

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::third-party-offering.third-party-offering', {
  config: {
    find: {
      auth: false,
    },
    findOne: {
      auth: false,
    },
  },
});

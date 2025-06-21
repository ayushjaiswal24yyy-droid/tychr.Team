'use strict';

/**
 * external-user router
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::external-user.external-user');

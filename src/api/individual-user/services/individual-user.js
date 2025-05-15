'use strict';

/**
 * individual-user service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::individual-user.individual-user');

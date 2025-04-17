'use strict';

/**
 * whats-new service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::whats-new.whats-new');

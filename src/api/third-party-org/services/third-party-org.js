'use strict';

/**
 * third-party-org service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::third-party-org.third-party-org');

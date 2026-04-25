'use strict';

/**
 * third-party-offering service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::third-party-offering.third-party-offering');
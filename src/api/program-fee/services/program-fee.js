'use strict';

/**
 * program-fee service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::program-fee.program-fee');

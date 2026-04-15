'use strict';

/**
 * admission-probability service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::admission-probability.admission-probability');

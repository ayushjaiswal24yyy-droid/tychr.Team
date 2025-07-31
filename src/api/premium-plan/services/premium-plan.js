'use strict';

/**
 * premium-plan service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::premium-plan.premium-plan');

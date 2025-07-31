'use strict';

/**
 * user-plan service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::user-plan.user-plan');

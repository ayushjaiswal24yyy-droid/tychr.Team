'use strict';

/**
 * course-plan service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::course-plan.course-plan');

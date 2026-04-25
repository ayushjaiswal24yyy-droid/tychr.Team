'use strict';

/**
 * weekly-report service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::weekly-report.weekly-report');

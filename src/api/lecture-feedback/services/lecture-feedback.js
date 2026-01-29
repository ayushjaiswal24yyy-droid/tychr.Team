'use strict';

/**
 * lecture-feedback service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::lecture-feedback.lecture-feedback');

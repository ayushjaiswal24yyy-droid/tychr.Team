'use strict';

/**
 * student-notification service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::student-notification.student-notification');

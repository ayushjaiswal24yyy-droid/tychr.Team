'use strict';

/**
 * student-meeting service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::student-meeting.student-meeting');

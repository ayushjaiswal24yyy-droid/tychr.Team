'use strict';

/**
 * live-lectures-meeting service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::live-lectures-meeting.live-lectures-meeting');

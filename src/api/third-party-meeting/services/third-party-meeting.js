'use strict';

/**
 * third-party-meeting service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::third-party-meeting.third-party-meeting');

'use strict';

/**
 * demo-booking service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::demo-booking.demo-booking');

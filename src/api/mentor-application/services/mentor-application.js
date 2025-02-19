'use strict';

/**
 * mentor-application service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::mentor-application.mentor-application');

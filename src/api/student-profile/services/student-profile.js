'use strict';

/**
 * student-profile service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::student-profile.student-profile');

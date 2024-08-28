'use strict';

/**
 * grade-subject service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::grade-subject.grade-subject');

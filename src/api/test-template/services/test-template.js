'use strict';

/**
 * test-template service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::test-template.test-template');

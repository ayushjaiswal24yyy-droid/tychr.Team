'use strict';

/**
 * program-type service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::program-type.program-type');

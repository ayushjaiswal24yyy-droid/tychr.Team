'use strict';

/**
 * exemplar service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::exemplar.exemplar');

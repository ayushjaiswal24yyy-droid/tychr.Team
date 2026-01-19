'use strict';

/**
 * sat-city service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::sat-city.sat-city');

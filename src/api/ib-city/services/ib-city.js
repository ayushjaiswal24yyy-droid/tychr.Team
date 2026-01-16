'use strict';

/**
 * ib-city service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::ib-city.ib-city');

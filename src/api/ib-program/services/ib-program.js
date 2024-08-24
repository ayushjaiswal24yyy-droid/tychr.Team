'use strict';

/**
 * ib-program service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::ib-program.ib-program');

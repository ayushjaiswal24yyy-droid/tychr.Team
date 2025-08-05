'use strict';

/**
 * transaction-out service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::transaction-out.transaction-out');

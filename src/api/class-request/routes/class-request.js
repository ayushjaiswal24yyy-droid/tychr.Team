'use strict';

/**
 * class-request router
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::class-request.class-request');

'use strict';

/**
 * recorded-lecture service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::recorded-lecture.recorded-lecture');

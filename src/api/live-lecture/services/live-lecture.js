'use strict';

/**
 * live-lecture service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::live-lecture.live-lecture');

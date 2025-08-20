'use strict';

/**
 * gst service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::gst.gst');

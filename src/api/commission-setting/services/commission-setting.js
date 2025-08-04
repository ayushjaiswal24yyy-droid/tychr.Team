'use strict';

/**
 * commission-setting service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::commission-setting.commission-setting');

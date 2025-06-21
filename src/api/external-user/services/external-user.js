'use strict';

/**
 * external-user service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::external-user.external-user');

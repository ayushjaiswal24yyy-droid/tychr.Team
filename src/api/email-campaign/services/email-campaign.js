'use strict';

/**
 * email-campaign service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::email-campaign.email-campaign');

'use strict';

/**
 * application-review service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::application-review.application-review');

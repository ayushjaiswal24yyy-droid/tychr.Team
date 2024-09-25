'use strict';

/**
 * question-bank service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::question-bank.question-bank');

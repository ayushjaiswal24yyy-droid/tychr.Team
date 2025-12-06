'use strict';

/**
 * tutors service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::tutors.tutors');

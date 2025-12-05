'use strict';

/**
 * tutors-website service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::tutors-website.tutors-website');

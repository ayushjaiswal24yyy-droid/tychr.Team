'use strict';

const { factories } = require('@strapi/strapi');

const { createCoreController } = factories;

module.exports = createCoreController('api::course.course', ({ strapi }) => ({
    ...createCoreController('api::course.course'),

    async find(ctx) {
        // Existing find method
        const { data, meta } = await super.find(ctx);

        const { query } = ctx;
        if (query.filters && query.filters.$or) {
            // The filtering is handled by Strapi's query engine
        }

        return { data, meta };
    },

    async getTrendingCourses(ctx) {
        try {
            const { limit = 10 } = ctx.query;
            const limitValue = parseInt(limit, 10);
            const courses = await strapi.entityService.findMany('api::course.course', {
                filters: {
                    isTrending: true
                },
                limit: limitValue,
                populate: ['image', 'tutors.avatar', 'lectures']
            });

            console.log(courses);

            ctx.body = courses;
        } catch (error) {
            ctx.body = error;
            ctx.status = 500;
        }
    },

    async getPopularCourses(ctx) {
        try {
            const { limit = 10 } = ctx.query;
            const limitValue = parseInt(limit, 10);
            const popularCourses = await strapi.entityService.findMany('api::course.course', {
                sort: { popular: 'desc' },
                limit: limitValue,
                populate: ['image', 'tutors.avatar', 'lectures']
            });

            ctx.body = popularCourses;
        } catch (error) {
            ctx.body = error;
            ctx.status = 500;
        }
    },

    async getEnrolledCourses(ctx) {
        try {
            const { limit = 10 } = ctx.query;
            const limitValue = parseInt(limit, 10);

            const { userId } = ctx.params;
            console.log(userId);

            if (!userId) {
                return ctx.badRequest("User ID is required");
            }

            // First, find all enrollments for the user
            const enrollments = await strapi.entityService.findMany('api::enrollment.enrollment', {
                filters: {
                    users: userId
                },
                populate: ['course']
            });

            console.log(enrollments);

            // Extract course IDs from enrollments
            const courseIds = enrollments.map(enrollment => enrollment.course.id);

            // Now fetch the full course details for these IDs
            const enrolledCourses = await strapi.entityService.findMany('api::course.course', {
                filters: {
                    id: {
                        $in: courseIds
                    }
                },
                limit: limitValue,
                populate: ['image', 'tutors.avatar', 'lectures']
            });

            ctx.body = enrolledCourses;
        } catch (error) {
            console.error(error);
            ctx.body = { error: "An error occurred while fetching enrolled courses" };
            ctx.status = 500;
        }
    }
}));
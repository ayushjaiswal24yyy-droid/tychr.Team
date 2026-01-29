'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController(
  'api::lecture-feedback.lecture-feedback',
  ({ strapi }) => ({
    async create(ctx) {
      const user = ctx.state.user;
      const { lectureId, rating, review } = ctx.request.body;

      if (!user) {
        return ctx.unauthorized('You must be logged in');
      }

      if (!lectureId || !rating) {
        return ctx.badRequest('Lecture and rating are required');
      }

      // Optional: attendance check
      const attended = await strapi.db
        .query('api::attendance.attendance')
        .findOne({
          where: {
            lecture: lectureId,
            user: user.id,
            attended: true,
          },
        });

      if (!attended) {
        return ctx.forbidden('You did not attend this lecture');
      }

      // Check existing review
      const existing = await strapi.db
        .query('api::lecture-feedback.lecture-feedback')
        .findOne({
          where: {
            lecture: lectureId,
            user: user.id,
          },
        });

      if (existing) {
        return ctx.conflict('You have already reviewed this lecture');
      }

      // Create feedback
      const feedback = await strapi.db
        .query('api::lecture-feedback.lecture-feedback')
        .create({
          data: {
            lecture: lectureId,
            user: user.id,
            rating,
            review,
          },
        });

      return ctx.send({ data: feedback });
    },
     async pendingReview(ctx) {
      const user = ctx.state.user;

      if (!user) {
        return ctx.unauthorized();
      }

      const now = new Date();

      /**
       * 1. Find attended lectures (most recent first)
       */
      const attendances = await strapi.db
        .query('api::attendance.attendance')
        .findMany({
          where: {
            user: user.id,
            attended: true,
          },
          populate: {
            lecture: {
              populate: {
                lecture_feedbacks: {
                  where: {
                    user: user.id,
                  },
                },
              },
            },
          },
          orderBy: {
            lecture: { schedule: 'desc' },
          },
        });

      for (const attendance of attendances) {
        const lecture = attendance.lecture;

        if (!lecture) continue;

        // ---- COMPLETION CHECK (derived) ----
        const start = new Date(lecture.schedule);
        const duration = lecture.duration_minutes ?? 60;
        const bufferMinutes = 15;

        const completedAt = new Date(
          start.getTime() + (duration + bufferMinutes) * 60 * 1000
        );

        if (now < completedAt) continue;

        // ---- REVIEW CHECK ----
        if (!lecture.lecture_feedbacks?.length) {
          return ctx.send({
            data: lecture,
          });
        }
      }

      return ctx.send({ data: null });
    },
  
  })
);

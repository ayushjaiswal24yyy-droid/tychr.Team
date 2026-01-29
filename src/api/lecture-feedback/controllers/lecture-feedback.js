'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController(
    'api::lecture-feedback.lecture-feedback',
    ({ strapi }) => ({
        async create(ctx) {
            try {
                const user = ctx.state.user;
                const { lectureId, rating, review } = ctx.request.body;

                if (!user) {
                    return ctx.unauthorized('You must be logged in');
                }

                if (!lectureId || !rating) {
                    return ctx.badRequest('Lecture and rating are required');
                }

                if (rating < 1 || rating > 5) {
                    return ctx.badRequest('Rating must be between 1 and 5');
                }

                // 1️⃣ Attendance check (correct for your schema)
                const attended = await strapi.db
                    .query('api::attendance.attendance')
                    .findOne({
                        where: {
                            student: user.id,
                            live_lecture: lectureId,
                            status: {
                                $in: ['present', 'late'],
                            },
                        },
                    });

                if (!attended) {
                    return ctx.forbidden('You did not attend this lecture');
                }

                // 2️⃣ Check existing review
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

                // 3️⃣ Create feedback
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
            } catch (error) {
                strapi.log.error('lecture-feedback.create error:', error);
                return ctx.internalServerError('Failed to submit review');
            }
        },
async pendingReview(ctx) {
  try {
    const user = ctx.state.user;

    if (!user) {
      return ctx.unauthorized();
    }

    // 1️⃣ Get attended lectures
    const attendances = await strapi.db
      .query('api::attendance.attendance')
      .findMany({
        where: {
          student: user.id,
          status: { $in: ['present', 'late'] },
        },
        populate: {
          live_lecture: true,
        },
      });

    // 2️⃣ Sort by lecture schedule DESC
    const sorted = attendances
      .filter(a => a.live_lecture?.schedule)
      .sort(
        (a, b) =>
          new Date(b.live_lecture.schedule).getTime() -
          new Date(a.live_lecture.schedule).getTime()
      );

    // 3️⃣ Find first completed lecture without feedback
    for (const attendance of sorted) {
      const lecture = attendance.live_lecture;
      if (!lecture) continue;

      if (lecture.lecture_status !== 'completed') continue;

      // 🔥 IMPORTANT: check feedback via separate query
      const existingFeedback = await strapi.db
        .query('api::lecture-feedback.lecture-feedback')
        .findOne({
          where: {
            live_lecture: lecture.id,
            user: user.id,
          },
        });

      if (!existingFeedback) {
        return ctx.send({ data: lecture });
      }
    }

    return ctx.send({ data: null });
  } catch (error) {
    strapi.log.error('pendingReview error:', error);
    return ctx.internalServerError('Failed to get pending review');
  }
}



    })
);

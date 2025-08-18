module.exports = {
  async find(ctx) {
    try {
      const page = parseInt(ctx.query.page, 10) || 1;
      const pageSize = parseInt(ctx.query.pageSize, 10) || 10;
      const start = (page - 1) * pageSize;

      // Define filter conditions
      const where = {
        role: {
          name: 'Tutor'
        }
      };

      // Add optional filters if they exist in query
      if (ctx.query.confirmTutor !== undefined) {
        where.confirmTutor = ctx.query.confirmTutor === 'true';
      }

      if (ctx.query.tutor_type) {
        where.tutor_type = ctx.query.tutor_type;
      }

      if (ctx.query.tutor_grade_subject) {
        where.tutor_grade_subject = ctx.query.tutor_grade_subject;
      }

      // Handle nationality filter
      const specificNationalities = ["India", "United States", "Canada"];
      if (ctx.query.nationality) {
        if (specificNationalities.includes(ctx.query.nationality)) {
          where.nationality = ctx.query.nationality;
        } else {
          where.nationality = { $notIn: specificNationalities };
        }
      }

      // Query with pagination
      const [results, total] = await Promise.all([
        strapi.db.query("plugin::users-permissions.user").findMany({
          where,
          populate: [
            "role",
            "cv",
            "subject_of_expertise",
            "tutor_grade_subject",
            "tutor_video",
            "teaching",
            "notifications" // Fixed typo from 'notification' to 'notifications'
          ],
          offset: start,
          limit: pageSize,
          orderBy: { createdAt: 'desc' } // Added sorting
        }),
        strapi.db.query("plugin::users-permissions.user").count({ where })
      ]);

      ctx.body = {
        results,
        pagination: {
          page,
          pageSize,
          pageCount: Math.ceil(total / pageSize),
          total
        }
      };
    } catch (err) {
      ctx.throw(500, err);
    }
  }
};
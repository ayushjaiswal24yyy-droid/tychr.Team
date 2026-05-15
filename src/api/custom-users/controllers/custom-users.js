// dependency to '../../third-party-offering/utils/format' removed per request

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

      // Fetch offerings for each educator
      const educatorsWithOfferings = await Promise.all(
        results.map(async (educator) => {
          try {
            // Get offerings created by this educator
            const offerings = await strapi.entityService.findMany(
              'api::third-party-offering.third-party-offering',
              {
                filters: {
                  created_by_user: educator.id,
                  publishedAt: { $notNull: true }
                },
                populate: {
                  tasks: true,
                  tp_applicants: {
                    fields: ['id', 'is_accepted', 'created_at']
                  }
                },
                sort: { createdAt: 'desc' },
                limit: 10 // Limit to recent offerings for performance
              }
            );

            // Format offerings data
            const formattedOfferings = Array.isArray(offerings)
              ? offerings.map((offering) => {
                  // Inline offering formatting to avoid external util dependency
                  let formatted;
                  if (offering && offering.attributes) {
                    formatted = offering;
                  } else if (offering) {
                    const { id, ...rest } = offering;
                    formatted = { id, attributes: rest };
                  } else {
                    formatted = { id: null, attributes: {} };
                  }
                  const applicantCount = Array.isArray(offering.tp_applicants)
                    ? offering.tp_applicants.length
                    : 0;
                  const acceptedCount = Array.isArray(offering.tp_applicants)
                    ? offering.tp_applicants.filter((app) => app.is_accepted).length
                    : 0;

                  return {
                    ...formatted,
                    attributes: {
                      ...formatted.attributes,
                      applicant_count: applicantCount,
                      accepted_count: acceptedCount
                    }
                  };
                })
              : [];

            return {
              ...educator,
              offerings: formattedOfferings,
              offerings_count: formattedOfferings.length
            };
          } catch (error) {
            console.error(`Error fetching offerings for educator ${educator.id}:`, error);
            return {
              ...educator,
              offerings: [],
              offerings_count: 0
            };
          }
        })
      );

      ctx.body = {
        results: educatorsWithOfferings,
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
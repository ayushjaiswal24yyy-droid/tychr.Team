"use strict";

module.exports = {
  async findFiltered(ctx) {
    try {
      const { query } = ctx;
      const { grade, subject_group, program, populate } = query;

      // Build filters
      let filters = {
        $and: [],
      };

      // Grade filter
      if (grade && !isNaN(grade)) {
        filters.$and.push({
          grade: {
            grade: { $eq: parseInt(grade) },
          },
        });
      }

      // Subject group filter (for non-PYP programs)
      if (subject_group && !isNaN(subject_group) && program !== "pyp") {
        filters.$and.push({
          subject_group: {
            id: { $eq: parseInt(subject_group) },
          },
        });
      }

      // Program filter through grade
      if (program) {
        const programName =
          program === "pyp" || program === "myp" || program === "dp"
            ? program.toUpperCase()
            : program;

        filters.$and.push({
          grade: {
            ib_programs: {
              name: { $eq: programName },
            },
          },
        });
      }

      // If no filters, get all published grade subjects
      if (filters.$and.length === 0) {
        delete filters.$and;
        filters.publishedAt = { $notNull: true };
      }

      // Default populate
      const populateObj = {
        topics: {
          populate: {
            subtopics: {
              populate: {
                notes: {
                  populate: {
                    question_banks: {
                      populate: "parts",
                    },
                  },
                },
              },
            },
          },
        },
        test_series: {
          populate: {
            question_banks: {
              populate: "parts.hints",
            },
          },
        },
        subject: true,
        grade: {
          populate: {
            ib_programs: true,
          },
        },
        subject_group: true,
      };

      const entities = await strapi.entityService.findMany(
        "api::grade-subject.grade-subject",
        {
          filters,
          populate: populateObj,
          publicationState: "live",
          sort: { name: "ASC" },
        }
      );

      // Return in frontend compatible format
      return {
        data: entities.map((entity) => ({
          id: entity.id,
          attributes: entity,
        })),
        meta: {
          pagination: {
            page: 1,
            pageSize: entities.length,
            total: entities.length,
            pageCount: 1,
          },
        },
      };
    } catch (error) {
      console.error("Error in findFiltered:", error);
      ctx.throw(500, `Error fetching grade subjects: ${error.message}`);
    }
  },
};

module.exports = {
  async find(ctx) {
    const page = parseInt(ctx.query.page, 10) || 1;
    const pageSize = parseInt(ctx.query.pageSize, 10) || 10;
    const confirmTutor = ctx.query.confirmTutor;
    const tutor_type = ctx.query.tutor_type;
    const tutor_grade_subject = ctx.query.tutor_grade_subject;
    const nationality = ctx.query.nationality;
    const start = (page - 1) * pageSize;

    const specificNationalities = ["India", "United States", "Canada"];

    const nationalityFilter = specificNationalities.includes(nationality)
      ? { nationality: { $in: nationality } }
      : { nationality: { $notIn: specificNationalities } };

    const results = await strapi.db
      .query("plugin::users-permissions.user")
      .findMany({
        where: {
          confirmTutor,
          ...nationalityFilter,
          tutor_type: tutor_type,
          tutor_grade_subject: tutor_grade_subject,
          role: {
            name: "Tutor",
          },
        },
        populate: [
          "role",
          "cv",
          "subject_of_expertise",
          "tutor_grade_subject",
          "tutor_video",
          "teaching",
          "notification",
        ],
        offset: start,
        limit: pageSize,
      });

    const total = await strapi.db
      .query("plugin::users-permissions.user")
      .count({
        where: {
          confirmTutor,
          role: {
            name: "Tutor",
          },
        },
      });

    const pagination = {
      page,
      pageSize,
      pageCount: Math.ceil(total / pageSize),
      total,
    };

    ctx.body = { results, pagination };
  },
};

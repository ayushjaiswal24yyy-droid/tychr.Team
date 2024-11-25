module.exports = {
  async find(ctx) {
    const page = parseInt(ctx.query.page, 10) || 1;
    const pageSize = parseInt(ctx.query.pageSize, 10) || 10;
    const confirmTutor = ctx.query.confirmTutor;
    const start = (page - 1) * pageSize;
    const results = await strapi.db
      .query("plugin::users-permissions.user")
      .findMany({
        where: {
          confirmTutor,
          role: {
            name: "Tutor",
          },
        },
        populate: ["role", "cv", "subject_of_expertise", "tutor_video"],
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

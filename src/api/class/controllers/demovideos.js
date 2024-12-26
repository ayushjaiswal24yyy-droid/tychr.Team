module.exports = {
  async find(ctx) {
    const { grade, gradeSubjectId, level } = ctx.query;

    const results = await strapi.db.query("api::class.class").findMany({
      where: {
        grade: grade,
      },
      populate: {
        grade_subjects: gradeSubjectId
          ? {
              where: {
                id: gradeSubjectId,
                ...(level && { level }), 
              },
              populate: ["recorded_lectures.thumbnail"],
            }
          : {
              where: level
                ? { level } 
                : undefined,
              populate: {
                recorded_lectures: { populate: { thumbnail: true } },
              },
            },
      },
    });

    ctx.body = { results };
  },
};

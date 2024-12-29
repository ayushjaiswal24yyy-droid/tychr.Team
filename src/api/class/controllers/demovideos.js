module.exports = {
  async find(ctx) {
    const { grade, gradeSubjectId, level } = ctx.query;

    const results = await strapi.db.query("api::class.class").findMany({
      where: {
        grade: grade,
      },
      populate: {
        grade_subjects: {
          where: gradeSubjectId
            ? {
                id: gradeSubjectId,
                ...(level && { level }),
              }
            : level
            ? { level }
            : undefined,
          populate: {
            recorded_lectures: {
              where: { isFree: true },
              populate: {
                thumbnail: true,
                classrooms: { populate: ["tutors.avatar"] },
              },
            },
          },
        },
      },
    });

    ctx.body = { results };
  },
};

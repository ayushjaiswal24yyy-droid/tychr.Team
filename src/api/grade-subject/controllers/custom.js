module.exports = {
  async findWithDetails(ctx) {
    const { id } = ctx.params;
    const { class_grade, ib_program } = ctx.query; // Query parameters for filters

    try {
      const filters = {};

      if (class_grade) {
        filters.classGrade = class_grade;
      }

      if (ib_program) {
        filters.ibProgram = ib_program;
      }

      const gradeSubject = await strapi
        .service("api::grade-subject.custom")
        .findWithTopicsAndSubtopics(id, filters);

      if (!gradeSubject) {
        return ctx.notFound(
          "Grade subject not found with the specified filters"
        );
      }

      return gradeSubject;
    } catch (err) {
      ctx.throw(500, err);
    }
  },
};

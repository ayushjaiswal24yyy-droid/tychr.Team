
module.exports = {
  async findWithDetails(ctx) {
    const { id } = ctx.params;
    
    try {
      const gradeSubject = await strapi
        .service('api::grade-subject.grade-subject')
        .findWithTopicsAndSubtopics(id);
      
      return gradeSubject;
    } catch (err) {
      ctx.throw(500, err);
    }
  }
};
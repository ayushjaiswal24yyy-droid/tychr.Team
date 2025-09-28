
module.exports = {
  async findWithTopicsAndSubtopics(gradeSubjectId) {
    const gradeSubject = await strapi.entityService.findOne(
      'api::grade-subject.grade-subject',
      gradeSubjectId,
      {
        populate: {
          topics: {
            populate: {
              subtopics: {
                populate: ['thumbnail']
              }
            }
          }
        }
      }
    );
    
    return gradeSubject;
  }
};
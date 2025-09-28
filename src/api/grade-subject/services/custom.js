module.exports = {
  async findWithTopicsAndSubtopics(gradeSubjectId, filters = {}) {
    const populateConfig = {
      populate: {
        topics: {
          populate: {
            subtopics: {
              populate: ['thumbnail']
            }
          }
        },
        grade: {
          populate: {
            ib_programs: true
          }
        },
        subject: true,
        subject_group: true
      }
    };

    // if class grade filter is provided
    if (filters.classGrade) {
      populateConfig.filters = {
        grade: {
          grade: filters.classGrade
        }
      };
    }

    // if IB program filter is provided
    if (filters.ibProgram) {
      if (!populateConfig.filters) {
        populateConfig.filters = {};
      }
      populateConfig.filters.grade = {
        ...populateConfig.filters.grade,
        ib_programs: {
          name: filters.ibProgram
        }
      };
    }

    const gradeSubject = await strapi.entityService.findOne(
      'api::grade-subject.grade-subject',
      gradeSubjectId,
      populateConfig
    );

    // if no gradeSubject found, return null
    if (!gradeSubject) {
      return null;
    }

    // Additional filtering based on class and IB program
    if (filters.classGrade && gradeSubject.grade?.grade !== parseInt(filters.classGrade)) {
      return null;
    }

    if (filters.ibProgram) {
      const hasIBProgram = gradeSubject.grade?.ib_programs?.some(
        program => program.name === filters.ibProgram
      );
      if (!hasIBProgram) {
        return null;
      }
    }

    return gradeSubject;
  }
};
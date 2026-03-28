'use strict';

module.exports = {
  async compare(ctx) {
    const { ids } = ctx.query;

    if (!ids) {
      return ctx.badRequest('ids query param is required (comma-separated program IDs)');
    }

    const programIds = ids
      .split(',')
      .map((id) => parseInt(id.trim(), 10))
      .filter((id) => !isNaN(id));

    if (programIds.length < 2) {
      return ctx.badRequest('At least 2 program IDs are required for comparison');
    }

    if (programIds.length > 6) {
      return ctx.badRequest('Maximum 6 programs can be compared at once');
    }

    const programs = await strapi.entityService.findMany('api::program.program', {
      filters: { id: { $in: programIds } },
      populate: {
        colleges: {
          populate: {
            // university is accessed via the university->colleges relation
            // We need to go up to university level for acceptance_rate, world_rank, location
          },
        },
        department: true,
        tution_fees: true,
        admission_requirements: true,
        financial_aids: true,
        intakes: true,
        application_deadlines: true,
      },
    });

    if (!programs || programs.length === 0) {
      return ctx.notFound('No programs found for the given IDs');
    }

    // For each program, fetch the parent university via its colleges
    const enriched = await Promise.all(
      programs.map(async (program) => {
        let universityData = null;

        // Get the first college linked to this program, then find its university
        const collegeIds = (program.colleges || []).map((c) => c.id);

        if (collegeIds.length > 0) {
          // Find the university that has this college
          const universities = await strapi.entityService.findMany('api::university.university', {
            filters: {
              colleges: { id: { $in: collegeIds } },
            },
            fields: [
              'university_name',
              'location',
              'world_rank',
              'acceptance_rate',
              'university_type',
            ],
            populate: {
              global_ranking: true,
              subject_ranking: true,
            },
          });

          if (universities && universities.length > 0) {
            universityData = universities[0];
          }
        }

        return {
          id: program.id,
          program_name: program.program_name,
          program_type: program.program_type,
          duration: program.duration,
          world_rank: program.world_rank,
          application_fee: program.application_fee,
          application_fee_currency: program.application_fee_currency,
          program_overview: program.program_overview,
          career_prospects: program.career_prospects,
          tution_fees: program.tution_fees || null,
          admission_requirements: program.admission_requirements || [],
          financial_aids: program.financial_aids || null,
          intakes: program.intakes || [],
          application_deadlines: program.application_deadlines || [],
          department: program.department
            ? { id: program.department.id, name: program.department.name }
            : null,
          colleges: (program.colleges || []).map((c) => ({
            id: c.id,
            college_name: c.college_name,
            college_type: c.college_type,
          })),
          university: universityData
            ? {
                id: universityData.id,
                university_name: universityData.university_name,
                location: universityData.location,
                world_rank: universityData.world_rank,
                acceptance_rate: universityData.acceptance_rate,
                university_type: universityData.university_type,
              }
            : null,
        };
      })
    );

    // Preserve the order of requested IDs
    const ordered = programIds
      .map((id) => enriched.find((p) => p.id === id))
      .filter(Boolean);

    ctx.body = { data: ordered };
  },
};
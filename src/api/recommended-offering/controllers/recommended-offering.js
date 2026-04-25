'use strict';

function normalizeTerm(value) {
  return String(value || '').toLowerCase().trim();
}

function toNormalizedStringArray(value) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value
      .flatMap((item) => (Array.isArray(item) ? item : [item]))
      .map(normalizeTerm)
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    const normalized = normalizeTerm(value);
    return normalized ? [normalized] : [];
  }

  return [];
}

module.exports = {
  async findRecommendations(ctx) {
    try {
      // STEP 1: Get logged-in user
      const user = ctx.state?.user;
      if (!user?.id) {
        return { data: [] };
      }

      // STEP 2: Check if user is student (role validation)
      const fullUser = await strapi.entityService.findOne('plugin::users-permissions.user', user.id, {
        populate: ['role']
      });

      if (!fullUser?.role?.name?.toLowerCase().includes('student')) {
        return { data: [] };
      }

      // STEP 3: Fetch student profile with dream profession and weekly reports
      const studentProfile = await strapi.entityService.findOne('api::student-profile.student-profile', user.id, {
        populate: ['weekly_reports']
      });

      if (!studentProfile) {
        return { data: [] };
      }

      // STEP 4: Extract data with safety checks
      const dreamProfession = normalizeTerm(studentProfile?.dream_profession);
      const weeklyReports = Array.isArray(studentProfile?.weekly_reports) ? studentProfile.weekly_reports : [];
      
      // Extract skills from weekly reports (skills_practiced field)
      const weeklySkills = weeklyReports.flatMap((report) =>
        toNormalizedStringArray(report?.skills_practiced)
      );

      // STEP 5: Fetch all third-party offerings
      const offerings = await strapi.entityService.findMany('api::third-party-offering.third-party-offering', {
        filters: { publishedAt: { $notNull: true } },
        populate: '*'
      });

      const safeOfferings = Array.isArray(offerings) ? offerings : [];

      // STEP 6: Match logic - compute scores
      const scoredOfferings = safeOfferings.map((offering) => {
        const targetProfessions = toNormalizedStringArray(offering?.target_professions);
        const skillTags = toNormalizedStringArray(offering?.skill_tags);

        let score = 0;

        // RULE 1: Dream profession matching (+3 points)
        if (dreamProfession && targetProfessions.includes(dreamProfession)) {
          score += 3;
        }

        // RULE 2: Weekly report skills matching (+1 point per match)
        weeklySkills.forEach((skill) => {
          if (skillTags.includes(skill)) {
            score += 1;
          }
        });

        return { offering, score };
      });

      // STEP 7: Filter and sort
      const filteredOfferings = scoredOfferings.filter(item => item.score > 0);
      filteredOfferings.sort((a, b) => b.score - a.score);

      // STEP 8: Limit top 6
      const topOfferings = filteredOfferings.slice(0, 6);

      return { data: topOfferings.map(item => item.offering) };

    } catch (error) {
      // Safety: return empty array on any error
      return { data: [] };
    }
  }
};

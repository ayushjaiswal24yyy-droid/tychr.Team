'use strict';

async function getRecommendations(userId) {
  try {
    const profiles = await strapi.entityService.findMany(
      'api::student-profile.student-profile',
      {
        filters: { user: userId },
        populate: { weekly_reports: true },
        limit: 1,
      }
    );

    const profile = Array.isArray(profiles) && profiles.length > 0 ? profiles[0] : null;

    if (!profile) return null;

    const dreamProfession = toSafeString(profile?.dream_profession);
    const rawReports = Array.isArray(profile?.weekly_reports) ? profile.weekly_reports : [];

    const weeklySkills = [
      ...new Set(
        rawReports
          .flatMap((r) => toStringArray(r?.skills_practiced))
          .map((s) => s.toLowerCase().trim())
          .filter(Boolean)
      ),
    ];

    const offerings = await strapi.entityService.findMany(
      'api::third-party-offering.third-party-offering',
      {
        publicationState: 'live',
        populate: ['college_tag', 'tasks'],
        limit: 500,
      }
    );

    if (!Array.isArray(offerings)) return [];

    const scored = offerings.map((offering) => {
      let score = 0;

      const targetProfessions = toStringArray(offering?.target_professions).map((p) =>
        p.toLowerCase().trim()
      );

      if (
        dreamProfession &&
        targetProfessions.some(
          (p) => p.includes(dreamProfession) || dreamProfession.includes(p)
        )
      ) {
        score += 50;
      }

      const offeringSkills = toStringArray(offering?.skill_tags).map((s) =>
        s.toLowerCase().trim()
      );

      const matchCount = weeklySkills.filter((s) => offeringSkills.includes(s)).length;
      score += matchCount * 10;

      return { ...offering, _score: score };
    });

    return scored.sort((a, b) => b._score - a._score);
  } catch (err) {
    console.error('GET_RECOMMENDATIONS SERVICE ERROR:', err);
    return [];
  }
}

function toSafeString(val) {
  if (typeof val === 'string') return val.toLowerCase().trim();
  return '';
}

function toStringArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

module.exports = { getRecommendations };


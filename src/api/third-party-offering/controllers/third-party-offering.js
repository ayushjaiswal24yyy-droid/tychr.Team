'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

function toStringArray(value) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value
      .flatMap((item) => (Array.isArray(item) ? item : [item]))
      .map((item) => String(item).trim())
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim()).filter(Boolean);
      }
    } catch (err) {
      return [trimmed];
    }

    return [trimmed];
  }

  return [];
}

function normalizeTerm(value) {
  return String(value || '').toLowerCase().trim();
}

function uniqueNormalized(values) {
  return [...new Set(toStringArray(values).map(normalizeTerm).filter(Boolean))];
}

function hasProfessionMatch(targetProfessions, dreamProfessions) {
  if (!Array.isArray(targetProfessions) || !Array.isArray(dreamProfessions)) return false;

  return targetProfessions.some((target) =>
    dreamProfessions.some(
      (dream) => target === dream || target.includes(dream) || dream.includes(target)
    )
  );
}

function countSkillMatches(skillTags, weeklySignals) {
  if (!Array.isArray(skillTags) || !Array.isArray(weeklySignals) || weeklySignals.length === 0) {
    return 0;
  }

  return skillTags.reduce((count, tag) => {
    const matched = weeklySignals.some(
      (signal) => tag === signal || tag.includes(signal) || signal.includes(tag)
    );
    return matched ? count + 1 : count;
  }, 0);
}

module.exports = createCoreController(
  'api::third-party-offering.third-party-offering',
  ({ strapi }) => ({
    async find(ctx) {
      try {
        const offerings = await strapi.entityService.findMany(
          'api::third-party-offering.third-party-offering',
          {
            publicationState: 'live',
            sort: { createdAt: 'desc' },
            populate: '*',
          }
        );

        const safeOfferings = Array.isArray(offerings) ? offerings : [];
        const validatedOfferings = safeOfferings.map((offering) => ({
          ...offering,
          title: offering?.title ?? null,
          description: offering?.description ?? null,
          category: offering?.category ?? null,
          skill_tags: offering?.skill_tags ?? null,
          activity_type: offering?.activity_type ?? null,
        }));
        console.log('THIRD PARTY OFFERINGS FIND COUNT:', safeOfferings.length);

        return ctx.send({ data: validatedOfferings });
      } catch (err) {
        console.error('THIRD PARTY OFFERINGS FIND ERROR:', err);
        return ctx.send({ data: [] });
      }
    },


    async findOne(ctx) {
      try {
        const { id } = ctx.params;
        const offering = await strapi.db
          .query('api::third-party-offering.third-party-offering')
          .findOne({
            where: {
              id,
              publishedAt: {
                $notNull: true,
              },
            },
            populate: true,
          });

        return ctx.send({ data: offering || null });
      } catch (err) {
        strapi.log.error('THIRD PARTY OFFERINGS FIND ONE ERROR:', err);
        return ctx.send({ data: null });
      }
    },

    async recommend(ctx) {
      try {
        const user = ctx.state?.user;
        if (!user?.id) {
          return ctx.send({ data: [] });
        }

        const profiles = await strapi.entityService.findMany(
          'api::student-profile.student-profile',
          {
            filters: { user: user.id },
            populate: { weekly_reports: true },
            limit: 1,
          }
        );

        const profile = Array.isArray(profiles) && profiles.length > 0 ? profiles[0] : null;
        if (!profile) {
          return ctx.send({ data: [] });
        }

        const dreamProfessions = uniqueNormalized([
          profile?.dream_profession,
          user?.dream_profession,
          user?.dream_profession_secondary,
        ]);

        const weeklyReports = Array.isArray(profile?.weekly_reports) ? profile.weekly_reports : [];
        const weeklySkills = weeklyReports.flatMap((report) =>
          uniqueNormalized(report?.skills_practiced)
        );
        const weeklyInterests = weeklyReports.flatMap((report) =>
          uniqueNormalized(report?.interests_discovered)
        );
        const weeklyActivities = weeklyReports.flatMap((report) =>
          uniqueNormalized([report?.activity_type, report?.activity, report?.activities])
        );

        const weeklySignals = [...new Set([...weeklySkills, ...weeklyInterests, ...weeklyActivities])];

        const offerings = await strapi.entityService.findMany(
          'api::third-party-offering.third-party-offering',
          {
            publicationState: 'live',
            populate: '*',
          }
        );

        const safeOfferings = Array.isArray(offerings) ? offerings : [];

        const scoredOfferings = safeOfferings
          .map((offering) => {
            const targetProfessions = uniqueNormalized(offering?.target_professions);
            const skillTags = uniqueNormalized(offering?.skill_tags);

            const professionMatch = hasProfessionMatch(targetProfessions, dreamProfessions);
            const skillMatchCount = countSkillMatches(skillTags, weeklySignals);
            const score = (professionMatch ? 2 : 0) + skillMatchCount;

            return { offering, score };
          })
          .filter((item) => item.score > 0)
          .sort((a, b) => b.score - a.score)
          .map((item) => item.offering);

        if (scoredOfferings.length > 0) {
          return ctx.send({ data: scoredOfferings });
        }

        const fallbackOfferings = await strapi.entityService.findMany(
          'api::third-party-offering.third-party-offering',
          {
            publicationState: 'live',
            sort: { createdAt: 'desc' },
            populate: '*',
            limit: 10,
          }
        );

        return ctx.send({ data: Array.isArray(fallbackOfferings) ? fallbackOfferings : [] });
      } catch (err) {
        console.error('THIRD PARTY OFFERINGS RECOMMEND ERROR:', err);
        return ctx.send({ data: [] });
      }
    }
  })
);


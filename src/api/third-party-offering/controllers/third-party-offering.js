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
    return trimmed.includes(',')
      ? trimmed
          .split(',')
          .map((item) => String(item).trim())
          .filter(Boolean)
      : [trimmed];
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
          region: offering?.region ?? null,
          tasks: offering?.tasks ?? [],
          target_professions: offering?.target_professions ?? [],
          skill_tags: offering?.skill_tags ?? [],
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
    // STEP 1: user
    const user = ctx.state?.user;
    if (!user?.id) {
      return { data: [] };
    }

    // STEP 2: get full user with role
    const fullUser = await strapi.entityService.findOne(
      'plugin::users-permissions.user',
      user.id,
      { populate: ['role'] }
    );

    if (!fullUser?.role?.name?.toLowerCase().includes('student')) {
      return { data: [] };
    }

    // STEP 3: fetch student profile properly
    const profiles = await strapi.entityService.findMany(
      'api::student-profile.student-profile',
      {
        filters: { user: user.id },
        populate: ['weekly_reports']
      }
    );

    const studentProfile = profiles?.[0];
    if (!studentProfile) {
      return { data: [] };
    }

    // STEP 4: extract data
    const dream = (studentProfile?.dream_profession || '').toLowerCase();

    const weeklySkills = (studentProfile?.weekly_reports || [])
      .flatMap(r => r?.skills_practiced || [])
      .map(s => String(s).toLowerCase());

    // STEP 5: fetch offerings
    const offerings = await strapi.entityService.findMany(
      'api::third-party-offering.third-party-offering',
      {
        filters: { publishedAt: { $notNull: true } }
      }
    );

    // STEP 6: scoring
    const scored = offerings.map(o => {
      let score = 0;

      const professions = (o.target_professions || []).map(p => p.toLowerCase());
      const skills = (o.skill_tags || []).map(s => s.toLowerCase());

      if (dream && professions.includes(dream)) {
        score += 3;
      }

      weeklySkills.forEach(skill => {
        if (skills.includes(skill)) {
          score += 1;
        }
      });

      return { o, score };
    });

    // STEP 7: filter + sort
    const result = scored
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map(x => x.o);

    return { data: result };

  } catch (err) {
    console.error("RECOMMEND ERROR:", err);
    return { data: [] };
  }
}
  })
);


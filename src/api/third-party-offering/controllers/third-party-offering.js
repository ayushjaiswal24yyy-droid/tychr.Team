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
        const { query } = ctx;
        const { activity_type, category, region, is_remote } = query;

        // Build filters based on query parameters
        const filters = {};
        if (activity_type) filters.activity_type = activity_type;
        if (category) filters.category = category;
        if (region) filters.region = region;
        if (is_remote !== undefined) filters.is_remote = is_remote === 'true';

        const offerings = await strapi.entityService.findMany(
          'api::third-party-offering.third-party-offering',
          {
            filters,
            publicationState: 'live',
            sort: { createdAt: 'desc' },
            populate: {
              tasks: true,
              created_by_user: {
                fields: ['id', 'fullName', 'email']
              },
              college_tag: {
                fields: ['id', 'name']
              }
            }
          }
        );

        const safeOfferings = Array.isArray(offerings) ? offerings : [];
        
        // Ensure consistent data structure for filtering
        const validatedOfferings = safeOfferings.map((offering) => ({
          ...offering,
          title: offering?.title || '',
          description: offering?.description || '',
          category: offering?.category || 'other',
          region: offering?.region || 'global-remote',
          activity_type: offering?.activity_type || 'other',
          is_remote: offering?.is_remote || false,
          tasks: Array.isArray(offering?.tasks) ? offering.tasks : [],
          target_professions: Array.isArray(offering?.target_professions) ? offering.target_professions : [],
          skill_tags: Array.isArray(offering?.skill_tags) ? offering.skill_tags : []
        }));

        return ctx.send({ data: validatedOfferings });
      } catch (err) {
        console.error('THIRD PARTY OFFERINGS FIND ERROR:', err);
        return ctx.send({ data: [] });
      }
    },

    async findOne(ctx) {
      try {
        const { id } = ctx.params;
        const offering = await strapi.entityService.findOne(
          'api::third-party-offering.third-party-offering',
          id,
          {
            populate: {
              tasks: true,
              created_by_user: {
                fields: ['id', 'fullName', 'email']
              },
              college_tag: {
                fields: ['id', 'name']
              }
            }
          }
        );

        if (!offering) {
          return ctx.notFound('Offering not found');
        }

        return ctx.send({ data: offering });
      } catch (err) {
        console.error('THIRD PARTY OFFERINGS FIND ONE ERROR:', err);
        return ctx.send({ data: null });
      }
    },

    async create(ctx) {
      try {
        const user = ctx.state?.user;
        if (!user?.id) {
          return ctx.unauthorized('You must be logged in to create offerings');
        }

        const data = {
          ...ctx.request.body.data,
          created_by_user: user.id
        };

        const offering = await strapi.entityService.create(
          'api::third-party-offering.third-party-offering',
          {
            data,
            populate: {
              tasks: true,
              created_by_user: {
                fields: ['id', 'fullName', 'email']
              }
            }
          }
        );

        return ctx.send({ data: offering });
      } catch (err) {
        console.error('THIRD PARTY OFFERINGS CREATE ERROR:', err);
        return ctx.badRequest('Failed to create offering');
      }
    },

    async update(ctx) {
      try {
        const { id } = ctx.params;
        const user = ctx.state?.user;
        
        if (!user?.id) {
          return ctx.unauthorized('You must be logged in to update offerings');
        }

        // Check if user owns the offering
        const existingOffering = await strapi.entityService.findOne(
          'api::third-party-offering.third-party-offering',
          id,
          {
            fields: ['id'],
            populate: {
              created_by_user: {
                fields: ['id']
              }
            }
          }
        );

        if (!existingOffering) {
          return ctx.notFound('Offering not found');
        }

        if (existingOffering.created_by_user?.id !== user.id) {
          return ctx.forbidden('You can only update your own offerings');
        }

        const offering = await strapi.entityService.update(
          'api::third-party-offering.third-party-offering',
          id,
          {
            data: ctx.request.body.data,
            populate: {
              tasks: true,
              created_by_user: {
                fields: ['id', 'fullName', 'email']
              }
            }
          }
        );

        return ctx.send({ data: offering });
      } catch (err) {
        console.error('THIRD PARTY OFFERINGS UPDATE ERROR:', err);
        return ctx.badRequest('Failed to update offering');
      }
    },

    async delete(ctx) {
      try {
        const { id } = ctx.params;
        const user = ctx.state?.user;
        
        if (!user?.id) {
          return ctx.unauthorized('You must be logged in to delete offerings');
        }

        // Check if user owns the offering
        const existingOffering = await strapi.entityService.findOne(
          'api::third-party-offering.third-party-offering',
          id,
          {
            fields: ['id'],
            populate: {
              created_by_user: {
                fields: ['id']
              }
            }
          }
        );

        if (!existingOffering) {
          return ctx.notFound('Offering not found');
        }

        if (existingOffering.created_by_user?.id !== user.id) {
          return ctx.forbidden('You can only delete your own offerings');
        }

        await strapi.entityService.delete('api::third-party-offering.third-party-offering', id);

        return ctx.send({ message: 'Offering deleted successfully' });
      } catch (err) {
        console.error('THIRD PARTY OFFERINGS DELETE ERROR:', err);
        return ctx.badRequest('Failed to delete offering');
      }
    },

    async addTask(ctx) {
      try {
        const { id } = ctx.params;
        const user = ctx.state?.user;
        
        if (!user?.id) {
          return ctx.unauthorized('You must be logged in to add tasks');
        }

        const { title, description, due_week, is_milestone } = ctx.request.body;

        if (!title) {
          return ctx.badRequest('Task title is required');
        }

        // Check if user owns the offering
        const existingOffering = await strapi.entityService.findOne(
          'api::third-party-offering.third-party-offering',
          id,
          {
            fields: ['id', 'tasks'],
            populate: {
              created_by_user: {
                fields: ['id']
              }
            }
          }
        );

        if (!existingOffering) {
          return ctx.notFound('Offering not found');
        }

        if (existingOffering.created_by_user?.id !== user.id) {
          return ctx.forbidden('You can only add tasks to your own offerings');
        }

        const currentTasks = Array.isArray(existingOffering.tasks) ? existingOffering.tasks : [];
        const newTask = {
          title,
          description: description || '',
          due_week: due_week || 1,
          is_milestone: is_milestone || false
        };

        const updatedOffering = await strapi.entityService.update(
          'api::third-party-offering.third-party-offering',
          id,
          {
            data: {
              tasks: [...currentTasks, newTask]
            },
            populate: {
              tasks: true
            }
          }
        );

        return ctx.send({ data: updatedOffering });
      } catch (err) {
        console.error('ADD TASK ERROR:', err);
        return ctx.badRequest('Failed to add task');
      }
    },

    async removeTask(ctx) {
      try {
        const { id, taskIndex } = ctx.params;
        const user = ctx.state?.user;
        
        if (!user?.id) {
          return ctx.unauthorized('You must be logged in to remove tasks');
        }

        // Check if user owns the offering
        const existingOffering = await strapi.entityService.findOne(
          'api::third-party-offering.third-party-offering',
          id,
          {
            fields: ['id', 'tasks'],
            populate: {
              created_by_user: {
                fields: ['id']
              }
            }
          }
        );

        if (!existingOffering) {
          return ctx.notFound('Offering not found');
        }

        if (existingOffering.created_by_user?.id !== user.id) {
          return ctx.forbidden('You can only remove tasks from your own offerings');
        }

        const currentTasks = Array.isArray(existingOffering.tasks) ? existingOffering.tasks : [];
        const taskIndexNum = parseInt(taskIndex);

        if (taskIndexNum < 0 || taskIndexNum >= currentTasks.length) {
          return ctx.badRequest('Invalid task index');
        }

        const updatedTasks = currentTasks.filter((_, index) => index !== taskIndexNum);

        const updatedOffering = await strapi.entityService.update(
          'api::third-party-offering.third-party-offering',
          id,
          {
            data: {
              tasks: updatedTasks
            },
            populate: {
              tasks: true
            }
          }
        );

        return ctx.send({ data: updatedOffering });
      } catch (err) {
        console.error('REMOVE TASK ERROR:', err);
        return ctx.badRequest('Failed to remove task');
      }
    },

    async getEducatorOfferings(ctx) {
      try {
        const user = ctx.state?.user;
        
        if (!user?.id) {
          return ctx.unauthorized('You must be logged in');
        }

        const offerings = await strapi.entityService.findMany(
          'api::third-party-offering.third-party-offering',
          {
            filters: {
              created_by_user: user.id,
              publishedAt: { $notNull: true }
            },
            sort: { createdAt: 'desc' },
            populate: {
              tasks: true,
              tp_applicants: {
                fields: ['id', 'status', 'created_at']
              }
            }
          }
        );

        return ctx.send({ data: Array.isArray(offerings) ? offerings : [] });
      } catch (err) {
        console.error('GET EDUCATOR OFFERINGS ERROR:', err);
        return ctx.send({ data: [] });
      }
    },

    async recommend(ctx) {
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

    async recommend(ctx) {
  try {
    // STEP 1: user
    const user = ctx.state?.user;
    if (!user?.id) {
      return ctx.send({ data: [] });
    }

    // STEP 2: get full user with role
    const fullUser = await strapi.entityService.findOne(
      'plugin::users-permissions.user',
      user.id,
      { populate: ['role'] }
    );

    if (!fullUser?.role?.name?.toLowerCase().includes('student')) {
      return ctx.send({ data: [] });
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
      return ctx.send({ data: [] });
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

    return ctx.send({ data: result });

  } catch (err) {
    console.error("RECOMMEND ERROR:", err);
    return ctx.send({ data: [] });
  }
}
  })
);


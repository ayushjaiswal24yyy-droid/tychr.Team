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

// Validation constants
const VALID_ACTIVITY_TYPES = [
  'internship', 'research', 'bootcamp', 'competition', 
  'volunteer', 'workshop', 'fellowship', 'other'
];

const VALID_CATEGORIES = [
  'stem', 'arts', 'business', 'social-science', 'medicine',
  'law', 'engineering', 'education', 'environment', 'other'
];

const VALID_REGIONS = [
  'north-america', 'south-america', 'europe', 'south-asia',
  'east-asia', 'southeast-asia', 'middle-east', 'africa',
  'oceania', 'global-remote'
];

// Helper functions
function validateActivityType(activityType) {
  return activityType && VALID_ACTIVITY_TYPES.includes(activityType) 
    ? activityType 
    : 'other';
}

function validateCategory(category) {
  return category && VALID_CATEGORIES.includes(category) 
    ? category 
    : 'other';
}

function validateRegion(region) {
  return region && VALID_REGIONS.includes(region) 
    ? region 
    : 'global-remote';
}

function validateTaskData(data) {
  const errors = [];
  
  if (!data.title || typeof data.title !== 'string' || data.title.trim().length === 0) {
    errors.push('Task title is required and must be a non-empty string');
  }
  
  if (data.due_week !== undefined) {
    const weekNum = parseInt(data.due_week);
    if (isNaN(weekNum) || weekNum < 1 || weekNum > 52) {
      errors.push('Task due_week must be a number between 1 and 52');
    }
  }
  
  if (data.is_milestone !== undefined && typeof data.is_milestone !== 'boolean') {
    errors.push('Task is_milestone must be a boolean');
  }
  
  return errors;
}

function standardizeOfferingData(data) {
  return {
    ...data,
    activity_type: validateActivityType(data.activity_type),
    category: validateCategory(data.category),
    region: validateRegion(data.region),
    is_remote: Boolean(data.is_remote),
    tasks: Array.isArray(data.tasks) ? data.tasks : []
  };
}

function formatOfferingResponse(offering) {
  return {
    id: offering.id,
    title: offering.title || '',
    description: offering.description || '',
    activity_type: offering.activity_type || 'other',
    category: offering.category || 'other',
    region: offering.region || 'global-remote',
    is_remote: offering.is_remote || false,
    startDate: offering.startDate,
    endDate: offering.endDate,
    eligibility: offering.eligibility || '',
    compensation: offering.compensation || '',
    tasks: Array.isArray(offering.tasks) ? offering.tasks : [],
    created_by_user: offering.created_by_user || null,
    publishedAt: offering.publishedAt
  };
}

module.exports = createCoreController(
  'api::third-party-offering.third-party-offering',
  ({ strapi }) => ({
    async find(ctx) {
      try {
        const { query } = ctx;
        const { activity_type, category, region, is_remote } = query;

        // Build filters based on query parameters with validation
        const filters = {};
        if (activity_type && VALID_ACTIVITY_TYPES.includes(activity_type)) {
          filters.activity_type = activity_type;
        }
        if (category && VALID_CATEGORIES.includes(category)) {
          filters.category = category;
        }
        if (region && VALID_REGIONS.includes(region)) {
          filters.region = region;
        }
        if (is_remote !== undefined) {
          filters.is_remote = is_remote === 'true';
        }

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
        
        // Use consistent formatting for all responses
        const formattedOfferings = safeOfferings.map(formatOfferingResponse);

        return ctx.send({ data: formattedOfferings });
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

        return ctx.send({ data: formatOfferingResponse(offering) });
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

        const inputData = ctx.request.body.data;
        
        // Validate and standardize input data
        const standardizedData = standardizeOfferingData(inputData);
        
        // Validate tasks if provided
        if (standardizedData.tasks && standardizedData.tasks.length > 0) {
          const taskErrors = standardizedData.tasks.reduce((errors, task, index) => {
            const validationErrors = validateTaskData(task);
            if (validationErrors.length > 0) {
              errors.push(`Task ${index + 1}: ${validationErrors.join(', ')}`);
            }
            return errors;
          }, []);
          
          if (taskErrors.length > 0) {
            return ctx.badRequest(`Task validation errors: ${taskErrors.join('; ')}`);
          }
        }

        const data = {
          ...standardizedData,
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

        return ctx.send({ data: formatOfferingResponse(offering) });
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

        const inputData = ctx.request.body.data;
        
        // Validate and standardize input data
        const standardizedData = standardizeOfferingData(inputData);
        
        // Validate tasks if provided
        if (standardizedData.tasks && standardizedData.tasks.length > 0) {
          const taskErrors = standardizedData.tasks.reduce((errors, task, index) => {
            const validationErrors = validateTaskData(task);
            if (validationErrors.length > 0) {
              errors.push(`Task ${index + 1}: ${validationErrors.join(', ')}`);
            }
            return errors;
          }, []);
          
          if (taskErrors.length > 0) {
            return ctx.badRequest(`Task validation errors: ${taskErrors.join('; ')}`);
          }
        }

        const offering = await strapi.entityService.update(
          'api::third-party-offering.third-party-offering',
          id,
          {
            data: standardizedData,
            populate: {
              tasks: true,
              created_by_user: {
                fields: ['id', 'fullName', 'email']
              }
            }
          }
        );

        return ctx.send({ data: formatOfferingResponse(offering) });
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

        // Validate task data
        const taskData = { title, description, due_week, is_milestone };
        const validationErrors = validateTaskData(taskData);
        
        if (validationErrors.length > 0) {
          return ctx.badRequest(`Validation errors: ${validationErrors.join(', ')}`);
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
          title: title.trim(),
          description: description || '',
          due_week: parseInt(due_week) || 1,
          is_milestone: Boolean(is_milestone)
        };

        const updatedOffering = await strapi.entityService.update(
          'api::third-party-offering.third-party-offering',
          id,
          {
            data: {
              tasks: [...currentTasks, newTask]
            },
            populate: {
              tasks: true,
              created_by_user: {
                fields: ['id', 'fullName', 'email']
              }
            }
          }
        );

        return ctx.send({ data: formatOfferingResponse(updatedOffering) });
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

        // Validate task index
        const taskIndexNum = parseInt(taskIndex);
        if (isNaN(taskIndexNum) || taskIndexNum < 0) {
          return ctx.badRequest('Invalid task index - must be a non-negative integer');
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

        if (taskIndexNum >= currentTasks.length) {
          return ctx.badRequest(`Invalid task index - only ${currentTasks.length} tasks available`);
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
              tasks: true,
              created_by_user: {
                fields: ['id', 'fullName', 'email']
              }
            }
          }
        );

        return ctx.send({ data: formatOfferingResponse(updatedOffering) });
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

    async getAllOfferings(ctx) {
      try {
        const { query } = ctx;
        const { activity_type, category, region, is_remote } = query;

        // Build filters based on query parameters with validation
        const filters = {
          publishedAt: { $notNull: true }
        };
        
        if (activity_type && VALID_ACTIVITY_TYPES.includes(activity_type)) {
          filters.activity_type = activity_type;
        }
        if (category && VALID_CATEGORIES.includes(category)) {
          filters.category = category;
        }
        if (region && VALID_REGIONS.includes(region)) {
          filters.region = region;
        }
        if (is_remote !== undefined) {
          filters.is_remote = is_remote === 'true';
        }

        const offerings = await strapi.entityService.findMany(
          'api::third-party-offering.third-party-offering',
          {
            filters,
            populate: {
              tasks: true,
              created_by_user: {
                fields: ['id', 'fullName', 'email']
              }
            },
            sort: { createdAt: 'desc' }
          }
        );

        const safeOfferings = Array.isArray(offerings) ? offerings : [];
        
        // Use consistent formatting for all responses
        const formattedOfferings = safeOfferings.map(formatOfferingResponse);

        return ctx.send({ results: formattedOfferings });
      } catch (err) {
        console.error('GET ALL OFFERINGS ERROR:', err);
        return ctx.send({ results: [] });
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


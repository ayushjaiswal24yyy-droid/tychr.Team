'use strict';

const { createCoreController } = require('@strapi/strapi').factories;
const { formatOfferingResponse } = require('../utils/format');

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
    const parts = trimmed.split(/[,/|]+/);
    return parts.map((item) => String(item).trim()).filter(Boolean);
  }

  return [];
}

function normalizeTerm(value) {
  return String(value || '').toLowerCase().trim();
}

function uniqueNormalized(values) {
  return [...new Set(toStringArray(values).map(normalizeTerm).filter(Boolean))];
}

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'or', 'the', 'to', 'of', 'for', 'in', 'on', 'with', 'by',
  'from', 'at', 'as', 'into', 'via', 'per', 'is', 'are', 'be', 'this', 'that'
]);

function tokenizeValue(value) {
  const normalized = normalizeTerm(value);
  if (!normalized) return [];
  const matches = normalized.match(/[a-z0-9]+/g) || [];
  return matches.filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function buildTokenSet(values) {
  const tokens = new Set();
  toStringArray(values).forEach((value) => {
    tokenizeValue(value).forEach((token) => tokens.add(token));
  });
  return tokens;
}

function countPartialTokenOverlap(left, right) {
  if (!left || !right || left.size === 0 || right.size === 0) return 0;
  let count = 0;
  left.forEach((token) => {
    const matched = Array.from(right).some(
      (candidate) => candidate.includes(token) || token.includes(candidate)
    );
    if (matched) count += 1;
  });
  return count;
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
  "Delhi", "Mumbai", "Bangalore", "Hyderabad", "Chennai", "Kolkata", "Pune", "Ahmedabad", "Jaipur", "Surat", "Lucknow", "Kanpur", "Nagpur", "Indore", "Bhopal", "Patna", "Ranchi", "Chandigarh", "Kochi", "Thiruvananthapuram", "Coimbatore", "Visakhapatnam", "Vijayawada", "Mysore", "Nashik", "Vadodara", "Rajkot", "Agra", "Varanasi", "Amritsar", "Ludhiana", "Jodhpur", "Udaipur", "Dehradun", "Noida", "Gurgaon", "Faridabad", "Ghaziabad", "Meerut", "Raipur", "Bhubaneswar", "Guwahati", "Shillong", "Imphal", "Aizawl", "Itanagar", "Gangtok", "Panaji", "Shimla", "Jammu"
];

// Helper functions
function normalizeEnumInput(value, validValues, aliases = {}) {
  if (value === null || value === undefined) return null;

  const raw = String(value).trim().toLowerCase();
  if (!raw) return null;

  if (aliases[raw]) return aliases[raw];

  const normalized = raw.replace(/[\s_]+/g, '-');
  if (validValues.includes(normalized)) return normalized;

  const collapsed = normalized.replace(/-/g, '');
  const match = validValues.find((entry) => entry.replace(/-/g, '') === collapsed);
  return match || null;
}

function validateActivityType(activityType) {
  const normalized = normalizeEnumInput(activityType, VALID_ACTIVITY_TYPES, {
    internships: 'internship',
    'internship program': 'internship',
    'internship-program': 'internship',
    'boot camp': 'bootcamp',
    'boot-camp': 'bootcamp',
    volunteering: 'volunteer',
    'work shop': 'workshop'
  });

  return normalized;
}

function validateCategory(category) {
  const normalized = normalizeEnumInput(category, VALID_CATEGORIES, {
    'social science': 'social-science',
    'social_science': 'social-science'
  });

  return normalized;
}

function validateRegion(region) {
  return region && VALID_REGIONS.includes(region);
}

function toFiniteNumberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;

  const trimmed = String(value).trim();
  if (!trimmed) return null;

  const direct = Number(trimmed);
  if (Number.isFinite(direct)) return direct;

  const extracted = trimmed.match(/-?\d+(?:\.\d+)?/);
  if (!extracted) return null;

  const parsed = Number(extracted[0]);
  return Number.isFinite(parsed) ? parsed : null;
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

function normalizeOfferingData(data, { partial = false } = {}) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { errors: ['Request body must include a data object'] };
  }

  const normalized = { ...data };
  const errors = [];

  if (normalized.city && !normalized.region) {
    normalized.region = normalized.city;
  }
  if (normalized.location && !normalized.Location) {
    normalized.Location = normalized.location;
  }
  if (!normalized.Location && normalized.region) {
    normalized.Location = normalized.region;
  }
  if (!normalized.region && normalized.Location && validateRegion(normalized.Location)) {
    normalized.region = normalized.Location;
  }
  delete normalized.city;
  delete normalized.location;

  if (!partial || normalized.activity_type !== undefined) {
    const normalizedActivity = validateActivityType(normalized.activity_type);
    if (normalizedActivity) {
      normalized.activity_type = normalizedActivity;
    } else if (normalized.activity_type !== undefined) {
      const rawActivity = String(normalized.activity_type).trim();
      if (rawActivity) {
        errors.push('activity_type must be one of the supported values');
      } else if (!partial) {
        normalized.activity_type = 'other';
      }
    } else if (!partial) {
      normalized.activity_type = 'other';
    }
  }

  if (!partial || normalized.category !== undefined) {
    const normalizedCategory = validateCategory(normalized.category);
    if (normalizedCategory) {
      normalized.category = normalizedCategory;
    } else if (normalized.category !== undefined) {
      const rawCategory = String(normalized.category).trim();
      if (rawCategory) {
        errors.push('category must be one of the supported values');
      } else if (!partial) {
        normalized.category = 'other';
      }
    } else if (!partial) {
      normalized.category = 'other';
    }
  }

  if (!partial || normalized.region !== undefined) {
    if (!validateRegion(normalized.region)) {
      errors.push('region must be one of the supported cities');
    }
  }

  if (normalized.is_remote !== undefined) {
    normalized.is_remote = Boolean(normalized.is_remote);
  }

  if (normalized.weekly_time_commitment !== undefined) {
    normalized.weekly_time_commitment = toFiniteNumberOrNull(
      normalized.weekly_time_commitment
    );
  }

  if (normalized.total_duration !== undefined) {
    normalized.total_duration = toFiniteNumberOrNull(normalized.total_duration);
  }

  if (normalized.tasks !== undefined) {
    if (!Array.isArray(normalized.tasks)) {
      errors.push('tasks must be an array');
    } else {
      const normalizedTasks = normalized.tasks.map((task) => {
        const dueWeekValue = task?.due_week !== undefined ? Number(task.due_week) : undefined;
        return {
          title: task?.title,
          description: task?.description,
          due_week: Number.isFinite(dueWeekValue) ? Math.trunc(dueWeekValue) : task?.due_week,
          is_milestone:
            task?.is_milestone !== undefined ? Boolean(task.is_milestone) : task?.is_milestone
        };
      });

      const taskErrors = normalizedTasks.reduce((acc, task, index) => {
        const validationErrors = validateTaskData(task);
        if (validationErrors.length > 0) {
          acc.push(`Task ${index + 1}: ${validationErrors.join(', ')}`);
        }
        return acc;
      }, []);

      errors.push(...taskErrors);
      normalized.tasks = normalizedTasks;
    }
  }

  return { data: normalized, errors };
}

function resolveRequestData(ctx) {
  const rawBody = ctx.request.body || {};
  const data = rawBody.data && typeof rawBody.data === 'object' ? rawBody.data : rawBody;
  return data;
}

function applyPublishDefaults(data, { allowDefault = true } = {}) {
  if (!data || typeof data !== 'object') return data;
  if (data.draft === true || data.publishedAt === null) {
    const { draft, ...rest } = data;
    return { ...rest, publishedAt: null };
  }
  if (allowDefault && data.publishedAt === undefined) {
    const { draft, ...rest } = data;
    return { ...rest, publishedAt: new Date().toISOString() };
  }
  const { draft, ...rest } = data;
  return rest;
}

module.exports = createCoreController(
  'api::third-party-offering.third-party-offering',
  ({ strapi }) => ({
    async find(ctx) {
      try {
        const queryFilters = ctx.query?.filters && typeof ctx.query.filters === 'object'
          ? ctx.query.filters
          : {};
        const offerings = await strapi.entityService.findMany(
          'api::third-party-offering.third-party-offering',
          {
            ...ctx.query,
            filters: {
              $and: [queryFilters, { publishedAt: { $notNull: true } }]
            },
            publicationState: 'live',
            populate: {
              created_by_user: {
                fields: ['id', 'fullName', 'email']
              },
              tasks: true,
              college_tag: true
            },
            sort: { createdAt: 'desc' }
          }
        );

        return ctx.send({
          data: offerings.map(formatOfferingResponse)
        });
      } catch (err) {
        console.error('FIND ERROR:', err);
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
        if (!offering.publishedAt) {
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
        console.log('[offerings][create][rawBody]', ctx.request.body);
        const user = ctx.state?.user;
        if (!user?.id) {
          return ctx.unauthorized('You must be logged in to create offerings');
        }

        const inputData = resolveRequestData(ctx);
        console.log('[offerings][create][resolvedData]', inputData);
        const { data: standardizedData, errors } = normalizeOfferingData(inputData);

        console.log('[offerings][create][normalizedData]', standardizedData);
        console.log('[offerings][create][normalizedTypes]', {
          Location: typeof standardizedData?.Location,
          weekly_time_commitment: typeof standardizedData?.weekly_time_commitment,
          total_duration: typeof standardizedData?.total_duration,
          region: typeof standardizedData?.region,
          activity_type: typeof standardizedData?.activity_type
        });

        if (errors.length > 0) {
          return ctx.badRequest(errors.join('; '));
        }

        const data = applyPublishDefaults({
          ...standardizedData,
          created_by_user: { connect: [user.id] }
        });

        console.log('[offerings][create][finalEntityData]', data);
        console.log('[offerings][create][finalEntityDataTypes]', {
          Location: typeof data?.Location,
          weekly_time_commitment: typeof data?.weekly_time_commitment,
          total_duration: typeof data?.total_duration,
          region: typeof data?.region,
          activity_type: typeof data?.activity_type
        });

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

        console.log('[offerings][create][savedOffering]', offering);
        return ctx.send({ data: formatOfferingResponse(offering) });
      } catch (err) {
        console.error('THIRD PARTY OFFERINGS CREATE ERROR:', err);
        if (err?.details) {
          console.error('THIRD PARTY OFFERINGS CREATE ERROR DETAILS:', err.details);
        }
        const message = err?.message || 'Failed to create offering';
        return ctx.badRequest(message);
      }
    },

    async createWithCity(ctx) {
      try {
        const user = ctx.state?.user;
        if (!user?.id) {
          return ctx.unauthorized('You must be logged in to create offerings');
        }

        const inputData = resolveRequestData(ctx);
        const { data: standardizedData, errors } = normalizeOfferingData(inputData);
        if (errors.length > 0) {
          return ctx.badRequest(errors.join('; '));
        }
        const data = applyPublishDefaults({
          ...standardizedData,
          created_by_user: { connect: [user.id] }
        });
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
        console.log('[offerings][update][rawBody]', ctx.request.body);
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
        const inputData = resolveRequestData(ctx);
        console.log('[offerings][update][resolvedData]', inputData);
        const { data: standardizedData, errors } = normalizeOfferingData(inputData, { partial: true });

        console.log('[offerings][update][normalizedData]', standardizedData);
        console.log('[offerings][update][normalizedTypes]', {
          Location: typeof standardizedData?.Location,
          weekly_time_commitment: typeof standardizedData?.weekly_time_commitment,
          total_duration: typeof standardizedData?.total_duration,
          region: typeof standardizedData?.region,
          activity_type: typeof standardizedData?.activity_type
        });
        if (errors.length > 0) {
          return ctx.badRequest(errors.join('; '));
        }

        const finalEntityData = applyPublishDefaults(standardizedData, { allowDefault: false });
        console.log('[offerings][update][finalEntityData]', finalEntityData);
        console.log('[offerings][update][finalEntityDataTypes]', {
          Location: typeof finalEntityData?.Location,
          weekly_time_commitment: typeof finalEntityData?.weekly_time_commitment,
          total_duration: typeof finalEntityData?.total_duration,
          region: typeof finalEntityData?.region,
          activity_type: typeof finalEntityData?.activity_type
        });

        const offering = await strapi.entityService.update(
          'api::third-party-offering.third-party-offering',
          id,
          {
            data: finalEntityData,
            populate: {
              tasks: true,
              created_by_user: {
                fields: ['id', 'fullName', 'email']
              }
            }
          }
        );

        console.log('[offerings][update][savedOffering]', offering);
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

        const taskPayload = resolveRequestData(ctx);
        const { title, description, due_week, is_milestone } = taskPayload;

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
        const updatedTasks = [...currentTasks, taskData];

        const updatedOffering = await strapi.entityService.update(
          'api::third-party-offering.third-party-offering',
          id,
          {
            data: { tasks: updatedTasks },
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
        const { id } = ctx.params;
        const user = ctx.state?.user;
        if (!user?.id) {
          return ctx.unauthorized('You must be logged in to remove tasks');
        }

        const taskIndex = ctx.params.taskIndex ?? resolveRequestData(ctx)?.taskIndex;
        const taskIndexNum = parseInt(taskIndex);

        // Check if user owns the offering
        const existingOffering = await strapi.entityService.findOne(
          'api::third-party-offering.third-party-offering',
          id,
          {
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

        if (Number.isNaN(taskIndexNum) || taskIndexNum < 0 || taskIndexNum >= currentTasks.length) {
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
          return ctx.unauthorized('You must be logged in to view your offerings');
        }

        const offerings = await strapi.entityService.findMany(
          'api::third-party-offering.third-party-offering',
          {
            filters: {
              created_by_user: {
                id: user.id
              }
            },
            populate: {
              college_tag: true,
              tasks: true,
              created_by_user: {
                fields: ['id', 'fullName', 'email']
              }
            },
            sort: { createdAt: 'desc' }
          }
        );

        return ctx.send({
          data: offerings.map(formatOfferingResponse)
        });
      } catch (err) {
        console.error('GET EDUCATOR OFFERINGS ERROR:', err);
        return ctx.send({ data: [] });
      }
    },

    async getAllOfferings(ctx) {
      try {
        const offerings = await strapi.entityService.findMany(
          'api::third-party-offering.third-party-offering',
          {
            filters: { publishedAt: { $notNull: true } },
            publicationState: 'live',
            populate: {
              created_by_user: {
                fields: ['id', 'fullName', 'email']
              },
              tasks: true,
              college_tag: true
            },
            sort: { createdAt: 'desc' }
          }
        );

        return ctx.send({ data: offerings.map(formatOfferingResponse) });
      } catch (err) {
        console.error('GET ALL OFFERINGS ERROR:', err);
        return ctx.send({ data: [] });
      }
    },

    async recommendAll(ctx) {
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

        return ctx.send({ data: validatedOfferings.map(formatOfferingResponse) });
      } catch (err) {
        console.error('THIRD PARTY OFFERINGS FIND ERROR:', err);
        return ctx.send({ data: [] });
      }
    },

    async getCategories(ctx) {
      try {
        // Return all valid categories as a structured response
        const categories = VALID_CATEGORIES.map((category, index) => ({
          id: index + 1,
          name: category,
          displayName: category.charAt(0).toUpperCase() + category.slice(1).replace('-', ' ')
        }));

        return ctx.send({ 
          data: categories,
          meta: {
            total: categories.length
          }
        });
      } catch (err) {
        console.error('GET CATEGORIES ERROR:', err);
        return ctx.send({ data: [] });
      }
    },

    async getRegions(ctx) {
      try {
        // Return all valid regions (cities) as a structured response
        const regions = VALID_REGIONS.map((region, index) => ({
          id: index + 1,
          name: region,
          displayName: region
        }));

        return ctx.send({ 
          data: regions,
          meta: {
            total: regions.length
          }
        });
      } catch (err) {
        console.error('GET REGIONS ERROR:', err);
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
        const dreamProfession = studentProfile?.dream_profession || '';
        const dreamTokens = buildTokenSet(dreamProfession);

        // STEP 5: fetch offerings
        const offerings = await strapi.entityService.findMany(
          'api::third-party-offering.third-party-offering',
          {
            filters: { publishedAt: { $notNull: true } },
            populate: {
              tasks: true,
              college_tag: true,
              created_by_user: {
                fields: ['id', 'fullName', 'email']
              }
            }
          }
        );

        // STEP 6: scoring
        const scored = offerings.map((offering) => {
          const titleTokens = buildTokenSet(offering?.title || '');
          const score = countPartialTokenOverlap(dreamTokens, titleTokens);
          return { o: offering, score };
        });

        // STEP 7: filter + sort
        const result = scored
          .filter(x => x.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 6)
          .map(x => formatOfferingResponse(x.o));

        return ctx.send({ data: result });

      } catch (err) {
        console.error("RECOMMEND ERROR:", err);
        return ctx.send({ data: [] });
      }
    },
  })
);

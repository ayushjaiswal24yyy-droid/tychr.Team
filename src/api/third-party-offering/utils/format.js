'use strict';

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function toArray(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function formatOfferingResponse(offering) {
  const region = offering?.region || null;
  const location = offering?.Location || offering?.location || region || null;

  return {
    id: offering?.id,
    attributes: {
      title: offering?.title || '',
      description: offering?.description || '',
      degree: offering?.degree || '',
      field_of_study: offering?.field_of_study || '',
      year: offering?.year || '',
      skills_required: toArray(offering?.skills_required),
      activity_type: offering?.activity_type || 'other',
      category: offering?.category || 'other',
      region,
      Location: location,
      location: location,
      is_remote: typeof offering?.is_remote === 'boolean' ? offering.is_remote : Boolean(offering?.is_remote),
      startDate: offering?.startDate ?? null,
      endDate: offering?.endDate ?? null,
      eligibility: offering?.eligibility || '',
      compensation: offering?.compensation || '',
      is_paid: typeof offering?.is_paid === 'boolean' ? offering.is_paid : Boolean(offering?.is_paid),
      stipend: offering?.stipend || '',
      currency: offering?.currency || '',
      weekly_time_commitment: toNumberOrNull(offering?.weekly_time_commitment),
      total_duration: toNumberOrNull(offering?.total_duration),
      selection_process: offering?.selection_process || '',
      benefits: toArray(offering?.benefits),
      application_process: offering?.application_process || {},
      tasks: toArray(offering?.tasks),
      target_professions: toArray(offering?.target_professions),
      skill_tags: toArray(offering?.skill_tags),
      created_by_user: offering?.created_by_user || null,
      college_tag: offering?.college_tag || null,
      createdAt: offering?.createdAt ?? null,
      updatedAt: offering?.updatedAt ?? null,
      publishedAt: offering?.publishedAt ?? null
    }
  };
}

function formatOfferingSummary(offering) {
  const formatted = formatOfferingResponse(offering);

  return {
    id: formatted.id,
    ...formatted.attributes
  };
}

const offeringResponseFields = [
  'id',
  'title',
  'description',
  'degree',
  'field_of_study',
  'year',
  'skills_required',
  'activity_type',
  'category',
  'region',
  'Location',
  'is_remote',
  'startDate',
  'endDate',
  'eligibility',
  'compensation',
  'is_paid',
  'stipend',
  'currency',
  'weekly_time_commitment',
  'total_duration',
  'selection_process',
  'benefits',
  'application_process',
  'target_professions',
  'skill_tags',
  'createdAt',
  'updatedAt',
  'publishedAt'
];

module.exports = {
  formatOfferingResponse,
  formatOfferingSummary,
  offeringResponseFields
};

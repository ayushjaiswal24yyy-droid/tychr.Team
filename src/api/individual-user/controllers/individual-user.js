'use strict';
const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::individual-user.individual-user', ({ strapi }) => ({
  async myStudents(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();

    // Get all offerings created by this user with full details
    const offerings = await strapi.entityService.findMany(
      'api::third-party-offering.third-party-offering',
      {
        filters: { created_by_user: user.id },
        populate: {
          tasks: true,
          tp_applicants: {
            where: { is_accepted: true },
            populate: {
              applied_by: {
                select: ['id', 'fullName', 'username', 'email'],
              },
            },
          },
        },
        sort: { createdAt: 'desc' },
      }
    );

    if (!offerings.length) return ctx.send({ data: [] });

    // Deduplicate students and collect their associated offerings
    const seen = new Set();
    const students = [];

    offerings.forEach(offering => {
      const acceptedApplicants = offering.tp_applicants || [];
      
      acceptedApplicants.forEach(applicant => {
        const student = applicant.applied_by;
        if (!student || seen.has(student.id)) return;
        
        seen.add(student.id);
        students.push({
          id: student.id,
          fullName: student.fullName || student.username,
          email: student.email,
          associatedOfferings: [{
            id: offering.id,
            title: offering.title,
            activity_type: offering.activity_type,
            category: offering.category,
            region: offering.region,
            is_remote: offering.is_remote,
            tasks: Array.isArray(offering.tasks) ? offering.tasks : [],
            startDate: offering.startDate,
            endDate: offering.endDate,
          }]
        });
      });
    });

    return ctx.send({ data: students });
  },
  async myApplicants(ctx) {
  const user = ctx.state.user;
  if (!user) return ctx.unauthorized();

  const { region, service, year, status, activity_type, category } = ctx.query;

  // Get full offerings data for this educator
  const offerings = await strapi.entityService.findMany(
    'api::third-party-offering.third-party-offering',
    {
      filters: { created_by_user: user.id },
      populate: {
        tasks: true,
        tp_applicants: {
          populate: {
            applied_by: true,
          },
        },
      },
      sort: { createdAt: 'desc' },
    }
  );

  if (!offerings.length) return ctx.send({ data: [] });

  // Filter offerings based on query parameters
  let filteredOfferings = offerings;
  
  if (region && region !== 'all') {
    filteredOfferings = filteredOfferings.filter(o => o.region === region);
  }
  
  if (service && service !== 'all') {
    filteredOfferings = filteredOfferings.filter(o => 
      o.title && o.title.toLowerCase().includes(service.toLowerCase())
    );
  }
  
  if (activity_type && activity_type !== 'all') {
    filteredOfferings = filteredOfferings.filter(o => o.activity_type === activity_type);
  }
  
  if (category && category !== 'all') {
    filteredOfferings = filteredOfferings.filter(o => o.category === category);
  }
  
  if (year && year !== 'all') {
    const yearStart = new Date(`${year}-01-01`);
    const yearEnd = new Date(`${year}-12-31`);
    filteredOfferings = filteredOfferings.filter(o => {
      if (!o.startDate) return false;
      const start = new Date(o.startDate);
      return start >= yearStart && start <= yearEnd;
    });
  }

  // Extract and filter applicants
  const applicants = [];
  
  filteredOfferings.forEach(offering => {
    const offeringApplicants = offering.tp_applicants || [];
    
    offeringApplicants.forEach(applicant => {
      // Filter by status if specified
      if (status && status !== 'all') {
        const isAccepted = status === 'accepted';
        if (applicant.is_accepted !== isAccepted) return;
      }
      
      applicants.push({
        id: applicant.id,
        is_accepted: applicant.is_accepted,
        createdAt: applicant.createdAt,
        created_at: applicant.createdAt,
        applied_by: applicant.applied_by,
        offering: {
          id: offering.id,
          title: offering.title,
          activity_type: offering.activity_type,
          category: offering.category,
          region: offering.region,
          is_remote: offering.is_remote,
          tasks: Array.isArray(offering.tasks) ? offering.tasks : [],
          startDate: offering.startDate,
          endDate: offering.endDate,
          description: offering.description,
          eligibility: offering.eligibility,
        }
      });
    });
  });

  // Sort by creation date (newest first)
  applicants.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return ctx.send({ data: applicants });
},
}));

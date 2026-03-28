'use strict';

module.exports = {
  async feeSummary(ctx) {
    const user = ctx.state.user;

    if (!user) {
      return ctx.unauthorized('You must be logged in to view fee summary');
    }

    const applications = await strapi.entityService.findMany(
      'api::student-uni-application.student-uni-application',
      {
        filters: {
          student: { id: user.id },
        },
        populate: {
          university: {
            fields: ['university_name'],
          },
          college: {
            fields: ['college_name'],
          },
          program: {
            fields: [
              'program_name',
              'application_fee',
              'application_fee_currency',
              'program_type',
            ],
          },
        },
        fields: [
          'id',
          'status',
          'universityDecision',
          'Category',
          'application_fee_paid',
          'Deadline',
        ],
      }
    );

    const items = applications.map((app) => {
      const fee = app.program?.application_fee ?? null;
      const currency = app.program?.application_fee_currency ?? null;

      return {
        application_id: app.id,
        status: app.status,
        category: app.Category,
        university_decision: app.universityDecision,
        deadline: app.Deadline,
        application_fee_paid: app.application_fee_paid ?? false,
        university: app.university
          ? { id: app.university.id, name: app.university.university_name }
          : null,
        college: app.college
          ? { id: app.college.id, name: app.college.college_name }
          : null,
        program: app.program
          ? {
              id: app.program.id,
              name: app.program.program_name,
              type: app.program.program_type,
            }
          : null,
        fee,
        currency,
      };
    });

    // Group totals by currency — paid vs outstanding separately
    const totals = {};

    for (const item of items) {
      if (item.fee === null || item.currency === null) continue;

      if (!totals[item.currency]) {
        totals[item.currency] = { paid: 0, outstanding: 0, total: 0 };
      }

      if (item.application_fee_paid) {
        totals[item.currency].paid += item.fee;
      } else {
        totals[item.currency].outstanding += item.fee;
      }

      totals[item.currency].total += item.fee;
    }

    const paid = items.filter((i) => i.application_fee_paid);
    const outstanding = items.filter((i) => !i.application_fee_paid);

    ctx.body = {
      data: {
        paid,
        outstanding,
        totals_by_currency: totals,
        counts: {
          total: items.length,
          paid: paid.length,
          outstanding: outstanding.length,
          no_fee_info: items.filter((i) => i.fee === null).length,
        },
      },
    };
  },
};
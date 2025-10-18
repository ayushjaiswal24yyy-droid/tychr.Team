module.exports = {
  draftEmail: {
    task: async ({ strapi }) => {
      const today = new Date().toISOString().split("T")[0];

      const expiredClassrooms = await strapi.entityService.findMany(
        "api::enrollment.enrollment",
        {
          filters: {
            endDate: { $lt: today },
            publishedAt: { $notNull: true },
          },
        }
      );

      await Promise.all(
        expiredClassrooms.map((classroom) =>
          strapi.entityService.update(
            "api::enrollment.enrollment",
            classroom.id,
            {
              data: { publishedAt: null },
            }
          )
        )
      );

      strapi.log.info(
        `Drafted ${expiredClassrooms.length} classrooms with expired end dates.`
      );
    },
    options: {
      rule: "0 0 * * *",
    },
  },

  // demoReminder: {
  //   task: async ({ strapi }) => { ... },
  //   options: { rule: "*/1 * * * *" },
  // },
};

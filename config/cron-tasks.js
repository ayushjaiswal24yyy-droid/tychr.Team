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
  demoReminder: {
    task: async ({ strapi }) => {
      const now = new Date();
      const reminderTime = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes from now
      const reminderISO = reminderTime.toISOString();

      // Find demo bookings happening within the next 5 minutes
      const upcomingDemos = await strapi.entityService.findMany(
        "api::demo-booking.demo-booking",
        {
          filters: {
            schedule_time: { $gte: now.toISOString(), $lte: reminderISO },
          },
          populate: {
            student: true,
            tutor: true,
          },
        }
      );

      await Promise.all(
        upcomingDemos.map(async (demo) => {
          const { student, tutor, schedule_time } = demo;

          if (student?.email) {
            await strapi.plugins["email"].services.email.send({
              to: student.email,
              subject: "Reminder: Upcoming Demo Booking",
              text: `Hi ${
                student.username
              },\n\nThis is a reminder for your upcoming demo booking scheduled at ${new Date(
                schedule_time
              ).toLocaleString()}.\n\nBest regards,\nTeam`,
            });
          }

          if (tutor?.email) {
            await strapi.plugins["email"].services.email.send({
              to: tutor.email,
              subject: "Reminder: Upcoming Demo Booking",
              text: `Hi ${
                tutor.username
              },\n\nThis is a reminder for your upcoming demo booking scheduled at ${new Date(
                schedule_time
              ).toLocaleString()}.\n\nBest regards,\nTeam`,
            });
          }
        })
      );

      strapi.log.info(
        `Sent ${upcomingDemos.length} demo reminders for bookings happening at ${reminderISO}.`
      );
    },
    options: {
      rule: "*/1 * * * *", 
    },
  },
};

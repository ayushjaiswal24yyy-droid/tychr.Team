"use strict";

/**
 * live-lecture controller
 */

const { createCoreController } = require("@strapi/strapi").factories;
const { createTeamsMeeting, getTeamsAccessToken } = require("../../../utils/teams")
module.exports = createCoreController(
  "api::live-lecture.live-lecture",
  ({ strapi }) => {
    // Helper method to send notifications asynchronously
    const sendLectureNotifications = async ({
      students,
      subject,
      title,
      description,
      topicname,
      teams_join_url,
      formattedSchedule,
      tutor,
    }) => {
      try {
        const emailPromises = students.map((student) => {
          return strapi.plugins["email"].services.email.send({
            to: student.email,
            from: "tychr@saralgroups.com",
            subject,
            text: `Dear student,

${title}

Topic: ${topicname?.name || "N/A"}
Description: ${description}
Class Link: ${teams_join_url}
Scheduled for: ${formattedSchedule}

Best regards,
${tutor?.fullName || "Your Tutor"}
        `,
            html: `
          <p>Dear student,</p>
          <p>${title}</p>
          <p><strong>Topic:</strong> ${topicname?.name || "N/A"}</p>
          <p><strong>Description:</strong> ${description}</p>
          <p><strong>Teams Link:</strong> <a href="${teams_join_url}">${teams_join_url}</a></p>
          <p><strong>Scheduled for:</strong> ${formattedSchedule}</p>
          <br/>
          <p>Best regards,<br/>${tutor?.fullName || "Your Tutor"}</p>
        `,
          });
        });

        await Promise.allSettled(emailPromises);
      } catch (err) {
        strapi.log.error("Email send error:", err);
      }
    };


    return {
      async create(ctx) {
        let response = null;

        try {
          const {
            schedule,
            classrooms,
            title,
            description,
            topic,
          } = ctx.request.body.data;

          // 1️⃣ Resolve classroom (manyToMany safe)
          const classroomIds = Array.isArray(classrooms)
            ? classrooms
            : [classrooms];

          const classroom = await strapi.entityService.findOne(
            "api::enrollment.enrollment",
            classroomIds[0],
            {
              populate: {
                tutor: true,
                students: true,
              },
            }
          );

          if (!classroom) {
            ctx.throw(400, "Classroom not found");
          }

          const tutor = classroom.tutor;
          const students = classroom.students || [];

          if (!tutor?.teams_refresh_token) {
            ctx.throw(400, "Tutor has not connected Microsoft Teams");
          }

          // 2️⃣ Get Teams access token
          const { accessToken } =
            await getTeamsAccessToken(tutor.teams_refresh_token, tutor.id);


          // 3️⃣ Create Teams meeting
          const start = new Date(schedule);
          const end = new Date(start.getTime() + 60 * 60 * 1000); // 1 hour

          const meeting = await createTeamsMeeting({
            accessToken,
            title,
            startTime: start.toISOString(),
            endTime: end.toISOString(),
          });

          // 4️⃣ Inject Teams data into lecture payload
          ctx.request.body.data.teams_join_url = meeting.joinUrl;
          ctx.request.body.data.teams_meeting_id = meeting.meetingId;

          // 5️⃣ Create lecture
          response = await super.create(ctx);

          // 6️⃣ Topic lookup (optional)
          let topicname = null;
          if (topic) {
            topicname = await strapi.entityService.findOne(
              "api::topic.topic",
              topic
            );
          }

          // 7️⃣ Format date
          const formattedSchedule = new Intl.DateTimeFormat("en-GB", {
            dateStyle: "long",
            timeStyle: "short",
          }).format(new Date(schedule));

          // 8️⃣ Send notifications (non-blocking)
          if (students.length > 0) {
            sendLectureNotifications({
              students,
              subject: `New Live Lecture: ${title}`,
              title,
              description,
              topicname,
              teams_join_url: meeting.joinUrl,
              formattedSchedule,
              tutor,
            }).catch((err) =>
              strapi.log.error("Lecture notification failed:", err)
            );
          }

          return ctx.send({
            message: "Live lecture created successfully",
            data: response.data || response,
          });
        } catch (error) {
          strapi.log.error("Error creating live lecture:", error);

          if (response) {
            return ctx.send({
              message: "Live lecture created with errors",
              data: response.data || response,
              error: error.message,
            });
          }

          ctx.throw(500, "Failed to create live lecture");
        }
      },

      async sendLectureReminders(ctx) {
        const secret = ctx.request.headers["x-cron-key"];
        if (secret !== process.env.CRON_SECRET) {
          return ctx.unauthorized("Invalid cron key");
        }

        const now = new Date();
        const to = new Date(now.getTime() + 30 * 60 * 1000);

        const lectures = await strapi.entityService.findMany(
          "api::live-lecture.live-lecture",
          {
            filters: {
              schedule: {
                $gt: now,
                $lte: to,
              },
              reminderSent: false,
            },
            populate: {
              topic: true,
              classrooms: {
                populate: {
                  students: true,
                  tutor: true,
                },
              },
            },
          }
        );

        let processed = 0;

        for (const lecture of lectures) {
          const classrooms = lecture.classrooms || [];

          let allStudents = [];
          for (const classroom of classrooms) {
            if (classroom?.students?.length) {
              allStudents.push(...classroom.students);
            }
          }

          if (!allStudents.length) continue;

          const uniqueStudents = Array.from(
            new Map(allStudents.map(s => [s.email, s])).values()
          );
          const formattedSchedule = new Intl.DateTimeFormat("en-GB", {
            dateStyle: "long",
            timeStyle: "short",
          }).format(new Date(lecture.schedule));

          await sendLectureNotifications({
            students: uniqueStudents,
            subject: "⏰ Live Lecture Starting Soon",
            title: "Your class starts in less than 30 minutes",
            description: lecture.description,
            topicname: lecture.topic,
            teams_join_url: lecture.teams_join_url,
            formattedSchedule,
            tutor: classrooms[0]?.tutor,
          });

          await strapi.entityService.update(
            "api::live-lecture.live-lecture",
            lecture.id,
            { data: { reminderSent: true } }
          );

          processed++;
        }


        return { ok: true, processed };
      }


    };
  }
);
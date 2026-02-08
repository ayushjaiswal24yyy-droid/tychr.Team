"use strict";

/**
 * live-lecture controller
 */

const { createCoreController } = require("@strapi/strapi").factories;
const { createTeamsMeeting } = require("../../../services/teams")
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
          <p><strong>Zoom Link:</strong> <a href="${teams_join_url}">${teams_join_url}</a></p>
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
        let classroom = null;
        let students = [];
        let response = null;
        let notificationResult = {
          attempted: [],
          succeeded: [],
          failed: []
        };

        try {
          const { title, description, schedule, topic, classrooms } =
            ctx.request.body.data;

          // 1️⃣ Create Teams meeting FIRST
          let meeting;
          try {
            meeting = await createTeamsMeeting({
              title,
              startTime: schedule,
              durationMinutes: 60,
            });
          } catch (err) {
            strapi.log.error("Teams meeting creation failed", err);
            ctx.throw(500, "Failed to create Teams meeting");
          }

          const teams_join_url = meeting.joinUrl;
          const teams_meeting_id = meeting.id;

          // 2️⃣ Inject Teams data BEFORE saving
          ctx.request.body.data.teams_join_url = teams_join_url;
          ctx.request.body.data.teams_meeting_id = teams_meeting_id;

          // 3️⃣ Create lecture ONCE
          response = await super.create(ctx);

          // 4️⃣ Fetch topic
          let topicname = null;
          if (topic) {
            topicname = await strapi.entityService.findOne(
              "api::topic.topic",
              topic
            );
          }

          // 5️⃣ Fetch classroom + students
          if (classrooms) {
            classroom = await strapi.entityService.findOne(
              "api::enrollment.enrollment",
              classrooms,
              {
                populate: {
                  students: true,
                  tutor: true,
                },
              }
            );

            if (classroom) {
              students = classroom.students || [];

              const formattedSchedule = new Intl.DateTimeFormat("en-GB", {
                dateStyle: "long",
                timeStyle: "short",
              }).format(new Date(schedule));

              if (students.length > 0) {
                notificationResult.attempted = students.map(s => s.email);

                sendLectureNotifications({
                  students,
                  title,
                  subject: `New Live Lecture: ${title}`,
                  description,
                  topicname,
                  teams_join_url,
                  formattedSchedule,
                  tutor: classroom.tutor,
                }).then(() => {
                  notificationResult.succeeded = students.map(s => s.email);
                }).catch(() => {
                  notificationResult.failed = students.map(s => s.email);
                });
              }
            }
          }

          return ctx.send({
            message: "Live lecture created successfully",
            data: response.data || response,
            notification: notificationResult,
          });

        } catch (error) {
          strapi.log.error("Error creating live lecture:", error);

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


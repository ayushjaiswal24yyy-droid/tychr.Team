"use strict";

/**
 * live-lecture controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

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
      zoom_url,
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
Class Link: ${zoom_url}
Scheduled for: ${formattedSchedule}

Best regards,
${tutor?.fullName || "Your Tutor"}
        `,
            html: `
          <p>Dear student,</p>
          <p>${title}</p>
          <p><strong>Topic:</strong> ${topicname?.name || "N/A"}</p>
          <p><strong>Description:</strong> ${description}</p>
          <p><strong>Zoom Link:</strong> <a href="${zoom_url}">${zoom_url}</a></p>
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
          // First, create the live lecture
          response = await super.create(ctx);

          const { title, description, zoom_url, schedule, topic, classrooms } =
            ctx.request.body.data;

          // Get topic details
          let topicname = null;
          if (topic) {
            topicname = await strapi.entityService.findOne(
              "api::topic.topic",
              topic
            );
          }

          // Get classroom with populated data
          if (classrooms) {
            classroom = await strapi.entityService.findOne(
              "api::enrollment.enrollment",
              classrooms,
              {
                populate: {
                  students: true,
                  tutor: true  // Changed from 'tutors' to 'tutor' (singular)
                },
              }
            );

            if (classroom) {
              students = classroom?.students || [];

              // Format schedule date
              let formattedSchedule = "N/A";
              if (schedule) {
                try {
                  formattedSchedule = new Intl.DateTimeFormat("en-GB", {
                    dateStyle: "long",
                    timeStyle: "short",
                  }).format(new Date(schedule));
                } catch (dateError) {
                  strapi.log.error("Error formatting schedule date:", dateError);
                }
              }

              // Send emails asynchronously without blocking the response
              if (students.length > 0) {
                // Track emails being sent
                notificationResult.attempted = students.map(s => s.email);

                // Send emails in background
                sendLectureNotifications({
                  students,
                  title,
                  subject: `New Live Lecture: ${title}`,
                  description,
                  topicname,
                  zoom_url,
                  formattedSchedule,
                  tutor: classroom.tutor, // Changed from classroom.tutors[0] to classroom.tutor
                }).then(() => {
                  notificationResult.succeeded = students.map(s => s.email);
                  strapi.log.info("Lecture notifications sent successfully");
                }).catch((err) => {
                  notificationResult.failed = students.map(s => s.email);
                  strapi.log.error("Failed to send email notifications:", err);
                });
              } else {
                strapi.log.warn("No students found in classroom:", classrooms);
              }
            } else {
              strapi.log.warn("Classroom not found with ID:", classrooms);
            }
          } else {
            strapi.log.warn("No classroom ID provided in request");
          }

          // Return success response with notification status
          return ctx.send({
            message: classroom
              ? "Live lecture created successfully"
              : "Live lecture created (but failed to fetch classroom details)",
            data: response.data || response,
            notification: notificationResult
          });
        } catch (error) {
          strapi.log.error("Error creating live lecture:", {
            message: error.message,
            stack: error.stack,
            details: error
          });

          // Return partial success if lecture was created
          if (response) {
            return ctx.send({
              message: "Live lecture created with errors",
              data: response.data || response,
              error: error.message,
              notification: notificationResult
            });
          } else {
            ctx.throw(500, "Failed to create live lecture");
          }
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
          const classroom = lecture.classrooms;
          if (!classroom?.students?.length) continue;

          const minutesLeft = Math.max(
            1,
            Math.round(
              (new Date(lecture.schedule).getTime() - now.getTime()) / 60000
            )
          );


          const formattedSchedule = new Intl.DateTimeFormat("en-GB", {
            dateStyle: "long",
            timeStyle: "short",
          }).format(new Date(lecture.schedule));

          await sendLectureNotifications({
            students: classroom.students,
            subject: "⏰ Live Lecture Starting Soon",
            title: `Your class starts in less than 30 minutes`,
            description: lecture.description,
            topicname: lecture.topic,
            zoom_url: lecture.zoom_url,
            formattedSchedule,
            tutor: classroom.tutor,
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


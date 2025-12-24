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
      title,
      description,
      topicname,
      zoom_url,
      formattedSchedule,
      tutor,
    }) => {
      try {
        if (!students || students.length === 0) {
          strapi.log.info("No students to notify");
          return;
        }

        const emailPromises = students.map((student) => {
          if (!student.email) {
            strapi.log.warn(`Student ${student.id} has no email`);
            return Promise.resolve();
          }

          const emailContent = {
            subject: `New Live Lecture: ${title}`,
            text: `Dear student,\n\nA new live lecture titled "${title}" has been scheduled.\n\nTopic: ${
              topicname?.name || "N/A"
            }\nDescription: ${description}\nClass Link: ${zoom_url}\nScheduled for: ${formattedSchedule}\n\nBest regards,\nYour Tutor\n${
              tutor?.fullName || "Your Tutor"
            }`,
            html: `
              <p>Dear student,</p>
              <p>A new live lecture titled "<strong>${title}</strong>" has been scheduled.</p>
              <p><strong>Topic:</strong> ${topicname?.name || "N/A"}</p>
              <p><strong>Description:</strong> ${description}</p>
              <p><strong>Zoom Link:</strong> <a href="${zoom_url}">${zoom_url}</a></p>
              <p><strong>Scheduled for:</strong> ${formattedSchedule}</p>
              <br/>
              <p>Best regards,<br/>Your Tutor<br/>${
                tutor?.fullName || "Your Tutor"
              }</p>
            `,
          };

          return strapi.plugins["email"].services.email.send({
            to: student.email,
            from: "tychr@saralgroups.com",
            subject: emailContent.subject,
            text: emailContent.text,
            html: emailContent.html,
          });
        });

        // Send all emails
        const results = await Promise.allSettled(emailPromises);

        // Log results
        const fulfilled = results.filter(
          (r) => r.status === "fulfilled"
        ).length;
        const rejected = results.filter((r) => r.status === "rejected").length;

        strapi.log.info(
          `Sent live lecture notifications: ${fulfilled} successful, ${rejected} failed`
        );

        // Log any errors
        results.forEach((result, index) => {
          if (result.status === "rejected") {
            strapi.log.error(
              `Failed to send email to student ${students[index]?.email}:`,
              result.reason
            );
          }
        });
      } catch (error) {
        strapi.log.error("Error in sendLectureNotifications:", error);
        // Don't rethrow - we don't want to affect the main request
      }
    };

    return {
      async create(ctx) {
        strapi.log.info("Creating live lecture...");

        try {
          // Validate required fields
          const { data } = ctx.request.body;

          if (!data) {
            return ctx.badRequest("Request body must contain 'data' field");
          }

          const { title, description, zoom_url, schedule, topic, classrooms } =
            data;

          // Required field validation
          if (!title) {
            return ctx.badRequest("Title is required");
          }
          if (!zoom_url) {
            return ctx.badRequest("Zoom URL is required");
          }
          if (!schedule) {
            return ctx.badRequest("Schedule is required");
          }
          if (!topic) {
            return ctx.badRequest("Topic is required");
          }
          if (!classrooms) {
            return ctx.badRequest("Classroom is required");
          }

          strapi.log.info("Creating live lecture with data:", {
            title,
            description: description?.substring(0, 50) + "...",
            zoom_url,
            schedule,
            topic,
            classrooms,
          });

          // First, create the live lecture
          const response = await super.create(ctx);

          if (!response) {
            return ctx.internalServerError(
              "Failed to create live lecture entry"
            );
          }

          const liveLectureId = response.data?.id || response?.id;
          strapi.log.info(`Live lecture created with ID: ${liveLectureId}`);

          // Get topic details
          const topicname = await strapi.entityService
            .findOne("api::topic.topic", topic)
            .catch((err) => {
              strapi.log.warn(`Failed to fetch topic ${topic}:`, err);
              return null;
            });

          // Get classroom with populated data
          let classroom;
          try {
            classroom = await strapi.entityService.findOne(
              "api::enrollment.enrollment",
              classrooms,
              {
                populate: { students: true, tutors: true },
              }
            );
          } catch (classroomError) {
            strapi.log.error(
              `Failed to fetch classroom ${classrooms}:`,
              classroomError
            );
            // Still return success since the lecture was created
            return ctx.send({
              message:
                "Live lecture created (but failed to fetch classroom details)",
              data: response.data || response,
            });
          }

          if (!classroom) {
            strapi.log.warn(`Classroom ${classrooms} not found`);
            return ctx.send({
              message: "Live lecture created (classroom not found)",
              data: response.data || response,
            });
          }

          // Format schedule date
          let formattedSchedule;
          try {
            formattedSchedule = new Intl.DateTimeFormat("en-GB", {
              dateStyle: "long",
              timeStyle: "short",
            }).format(new Date(schedule));
          } catch (dateError) {
            strapi.log.error("Failed to format schedule date:", dateError);
            formattedSchedule = schedule;
          }

          const students = classroom?.students || [];

          // Send emails asynchronously without blocking the response
          if (students.length > 0) {
            strapi.log.info(
              `Sending notifications to ${students.length} students`
            );

            sendLectureNotifications({
              students,
              title,
              description: description || "",
              topicname,
              zoom_url,
              formattedSchedule,
              tutor: classroom.tutors?.[0] || null,
            }).catch((err) => {
              strapi.log.error("Failed to send email notifications:", err);
            });
          } else {
            strapi.log.info("No students to notify");
          }

          // Return success response immediately
          return ctx.send({
            message: "Live lecture created successfully",
            data: response.data || response,
          });
        } catch (error) {
          strapi.log.error("Error creating live lecture:", error);
          strapi.log.error("Error details:", {
            message: error.message,
            stack: error.stack,
            body: ctx.request.body,
          });

          // Return the exact error that should appear in frontend
          return ctx.send(
            {
              data: null,
              error: {
                status: 500,
                name: "InternalServerError",
                message: "Failed to create class and notify students",
                details:
                  process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined,
              },
            },
            500
          );
        }
      },
    };
  }
);

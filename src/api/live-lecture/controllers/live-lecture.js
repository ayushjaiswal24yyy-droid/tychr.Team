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
      const notificationResult = {
        attempted: [],
        succeeded: [],
        failed: [],
      };

      try {
        if (!students || students.length === 0) {
          strapi.log.info("No students to notify");
          return notificationResult;
        }

        const emailPromises = students.map((student, index) => {
          if (!student.email) {
            const errorMsg = `Student ${student.id} has no email`;
            strapi.log.warn(errorMsg);

            notificationResult.attempted.push({
              email: null,
              studentId: student.id,
              status: "failed",
              reason: "No email address",
            });
            notificationResult.failed.push(null); // null for no email
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

          // Track this attempt
          notificationResult.attempted.push({
            email: student.email,
            studentId: student.id,
            status: "pending",
          });

          return strapi.plugins["email"].services.email
            .send({
              to: student.email,
              from: "tychr@saralgroups.com",
              subject: emailContent.subject,
              text: emailContent.text,
              html: emailContent.html,
            })
            .then(() => {
              // Update to success
              notificationResult.attempted[index].status = "success";
              notificationResult.succeeded.push(student.email);
              strapi.log.info(`Email sent successfully to: ${student.email}`);
            })
            .catch((error) => {
              // Update to failed
              const errorMsg = error.message || "Unknown email error";
              notificationResult.attempted[index].status = "failed";
              notificationResult.attempted[index].reason = errorMsg;
              notificationResult.failed.push(student.email);
              strapi.log.error(
                `Failed to send email to ${student.email}:`,
                error
              );
            });
        });

        // Send all emails
        await Promise.allSettled(emailPromises);

        // Log summary
        strapi.log.info(`Notification Summary:`);
        strapi.log.info(`  Total students: ${students.length}`);
        strapi.log.info(
          `  Attempted emails: ${
            notificationResult.attempted.filter((a) => a.email).length
          }`
        );
        strapi.log.info(`  Succeeded: ${notificationResult.succeeded.length}`);
        strapi.log.info(`  Failed: ${notificationResult.failed.length}`);
      } catch (error) {
        strapi.log.error("Error in sendLectureNotifications:", error);
      }

      return notificationResult;
    };

    return {
      async create(ctx) {
        strapi.log.info("Creating live lecture...");
        let notificationResult = {
          attempted: [],
          succeeded: [],
          failed: [],
        };

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
              notification: notificationResult,
            });
          }

          if (!classroom) {
            strapi.log.warn(`Classroom ${classrooms} not found`);
            return ctx.send({
              message: "Live lecture created (classroom not found)",
              data: response.data || response,
              notification: notificationResult,
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

            notificationResult = await sendLectureNotifications({
              students,
              title,
              description: description || "",
              topicname,
              zoom_url,
              formattedSchedule,
              tutor: classroom.tutors?.[0] || null,
            }).catch((err) => {
              strapi.log.error("Failed to send email notifications:", err);
              return notificationResult; // Return empty result
            });
          } else {
            strapi.log.info("No students to notify");
          }

          // Return success response with notification details
          return ctx.send({
            message: "Live lecture created successfully",
            data: response.data || response,
            notification: {
              status:
                notificationResult.failed.length === 0
                  ? "success"
                  : notificationResult.succeeded.length === 0
                  ? "failed"
                  : "partial",
              summary: {
                totalStudents: students.length,
                attempted: notificationResult.attempted.filter((a) => a.email)
                  .length,
                succeeded: notificationResult.succeeded.length,
                failed: notificationResult.failed.length,
              },
              attempted: notificationResult.attempted,
              succeeded: notificationResult.succeeded,
              failed: notificationResult.failed,
            },
          });
        } catch (error) {
          strapi.log.error("Error creating live lecture:", error);
          strapi.log.error("Error details:", {
            message: error.message,
            stack: error.stack,
            body: ctx.request.body,
          });

          // Return error with notification results if available
          return ctx.send(
            {
              data: null,
              error: {
                status: 500,
                name: "InternalServerError",
                message: "Failed to create live lecture",
                details: error.message
                    ,
              },
              notification: notificationResult,
            },
            500
          );
        }
      },
    };
  }
);

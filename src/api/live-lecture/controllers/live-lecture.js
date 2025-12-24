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
        const emailPromises = students.map((student) => {
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

        // Send all emails with a timeout
        await Promise.allSettled(emailPromises);
        strapi.log.info(
          `Sent live lecture notifications to ${students.length} students`
        );
      } catch (error) {
        strapi.log.error("Error in sendLectureNotifications:", error);
        // Don't rethrow - we don't want to affect the main request
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
    };
  }
);
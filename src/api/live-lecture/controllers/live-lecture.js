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
        try {
          // First, create the live lecture
          const response = await super.create(ctx);
          const liveLectureId = response.data?.id || response?.id;

          const { title, description, zoom_url, schedule, topic, classrooms } =
            ctx.request.body.data;

          // Get topic details
          const topicname = await strapi.entityService.findOne(
            "api::topic.topic",
            topic
          );

          // Get classroom with populated data
          const classroom = await strapi.entityService.findOne(
            "api::enrollment.enrollment",
            classrooms,
            {
              populate: { students: true, tutors: true },
            }
          );

          // Format schedule date
          const formattedSchedule = new Intl.DateTimeFormat("en-GB", {
            dateStyle: "long",
            timeStyle: "short",
          }).format(new Date(schedule));

          const students = classroom?.students || [];

          // Send emails asynchronously without blocking the response
          if (students.length > 0) {
            // Don't await here - let it run in background
            sendLectureNotifications({
              students,
              title,
              description,
              topicname,
              zoom_url,
              formattedSchedule,
              tutor: classroom.tutors[0],
            }).catch((err) => {
              strapi.log.error("Failed to send email notifications:", err);
            });
          }

          // Return success response immediately
          return ctx.send({
            message: "Live lecture created successfully",
            data: response.data || response,
          });
        } catch (error) {
          strapi.log.error("Error creating live lecture:", error);
          ctx.throw(500, "Failed to create live lecture");
        }
      },
    };
  }
);

"use strict";

/**
 * live-lecture controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::live-lecture.live-lecture",
  ({ strapi }) => ({
    async create(ctx) {
      try {
        const response = await super.create(ctx);
        const { title, description, zoom_url, schedule, topic, classrooms } =
          ctx.request.body.data;

        const topicname = await strapi.entityService.findOne(
          "api::topic.topic",
          topic
        );
        const classroom = await strapi.entityService.findOne(
          "api::enrollment.enrollment",
          classrooms,
          {
            populate: { students: true, tutors: true },
          }
        );
        const formattedSchedule = new Intl.DateTimeFormat("en-GB", {
          dateStyle: "long",
          timeStyle: "short",
        }).format(new Date(schedule));
        const students = classroom.students;
        if (students.length > 0) {
          const emailContent = {
            subject: `New Live Lecture: ${title}`,
            text: `Dear student,\n\nA new live lecture titled "${title}" has been scheduled.\n\nTopic: ${topicname.name}\nDescription: ${description}\nZoom Link: ${zoom_url}\nScheduled for: ${formattedSchedule}\n\nBest regards,\nYour Tutor \n${classroom.tutors[0].fullName}`,
          };

          await Promise.all(
            students.map((student) =>
              strapi.plugins["email"].services.email.send({
                to: student.email,
                from: "tychr@saralgroups.com",
                subject: emailContent.subject,
                text: emailContent.text,
              })
            )
          );

          return ctx.send({
            message: "Live lecture created successfully",
          });
        } else {
          return ctx.send({
            message: "Live lecture created successfully",
          });
        }
      } catch (error) {
        strapi.log.error(
          "Error creating class or sending notifications:",
          error
        );
        ctx.throw(500, "Failed to create class and notify students.");
      }
    },
  })
);

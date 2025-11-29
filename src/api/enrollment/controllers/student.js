"use strict";

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::enrollment.enrollment",
  ({ strapi }) => ({
    async getDemoVideos(ctx) {
      try {
        const { enrollmentId } = ctx.params;

        // Agar specific enrollment ID di hai to uski demo videos lao, nahi to sabki
        let filters = {};
        if (enrollmentId && enrollmentId !== "all") {
          filters.id = enrollmentId;
        }

        const enrollments = await strapi.entityService.findMany(
          "api::enrollment.enrollment",
          {
            filters,
            populate: {
              grade_subject: {
                populate: {
                  topics: {
                    populate: {
                      subtopics: {
                        populate: {
                          notes: {
                            populate: {
                              demo_video: true,
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          }
        );

        const result = enrollments.map((enrollment) => {
          const demoVideos = [];

          // Extract all demo videos from the hierarchy
          if (enrollment.grade_subject && enrollment.grade_subject.topics) {
            enrollment.grade_subject.topics.forEach((topic) => {
              if (topic.subtopics) {
                topic.subtopics.forEach((subtopic) => {
                  if (subtopic.notes) {
                    subtopic.notes.forEach((note) => {
                      if (note.demo_video) {
                        demoVideos.push({
                          enrollment_id: enrollment.id,
                          enrollment_name: enrollment.classroom_name,
                          grade_subject: enrollment.grade_subject?.name,
                          topic: topic.name,
                          subtopic: subtopic.name,
                          note: note.title,
                          demo_video: note.demo_video,
                        });
                      }
                    });
                  }
                });
              }
            });
          }

          return {
            enrollment_id: enrollment.id,
            enrollment_name: enrollment.classroom_name,
            grade_subject: enrollment.grade_subject?.name,
            total_demo_videos: demoVideos.length,
            demo_videos: demoVideos,
          };
        });

        // Filter out enrollments that have no demo videos if needed
        const filteredResult = result.filter(
          (item) => item.total_demo_videos > 0
        );

        return ctx.send({
          success: true,
          count: filteredResult.length,
          data: filteredResult,
        });
      } catch (error) {
        return ctx.send(
          {
            success: false,
            error: error.message,
          },
          500
        );
      }
    },

    async getEnrollmentDemoVideos(ctx) {
      try {
        const enrollmentId = ctx.params.id;

        const enrollment = await strapi.entityService.findOne(
          "api::enrollment.enrollment",
          enrollmentId,
          {
            populate: {
              grade_subject: {
                populate: {
                  topics: {
                    populate: {
                      subtopics: {
                        populate: {
                          notes: {
                            populate: {
                              demo_video: true,
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          }
        );

        if (!enrollment) {
          return ctx.send(
            {
              success: false,
              error: "Enrollment not found",
            },
            404
          );
        }

        const demoVideos = [];

        // Extract demo videos from the hierarchy
        if (enrollment.grade_subject && enrollment.grade_subject.topics) {
          enrollment.grade_subject.topics.forEach((topic) => {
            if (topic.subtopics) {
              topic.subtopics.forEach((subtopic) => {
                if (subtopic.notes) {
                  subtopic.notes.forEach((note) => {
                    if (note.demo_video) {
                      demoVideos.push({
                        topic: topic.name,
                        subtopic: subtopic.name,
                        note_title: note.title,
                        note_id: note.id,
                        demo_video: {
                          id: note.demo_video.id,
                          name: note.demo_video.name,
                          url: note.demo_video.url,
                          mime: note.demo_video.mime,
                          size: note.demo_video.size,
                        },
                      });
                    }
                  });
                }
              });
            }
          });
        }

        return ctx.send({
          success: true,
          enrollment: {
            id: enrollment.id,
            name: enrollment.classroom_name,
            grade_subject: enrollment.grade_subject?.name,
          },
          total_demo_videos: demoVideos.length,
          demo_videos: demoVideos,
        });
      } catch (error) {
        return ctx.send(
          {
            success: false,
            error: error.message,
          },
          500
        );
      }
    },
  })
);

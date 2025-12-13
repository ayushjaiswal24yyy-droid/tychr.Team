"use strict";

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::student-notification.student-notification",
  ({ strapi }) => ({
    // Get notifications for current student
    async findForStudent(ctx) {
      try {
        const user = ctx.state.user;

        if (!user) {
          return ctx.unauthorized("You must be logged in");
        }

        const {
          type,
          is_read,
          priority,
          limit = 20,
          page = 1,
          show_archived = false,
        } = ctx.query;

        let filters = {
          student: user.id,
          is_archived: show_archived === "true",
        };

        // Filter by type if provided
        if (type) {
          filters.type = type;
        }

        // Filter by read status if provided
        if (is_read !== undefined) {
          filters.is_read = is_read === "true";
        }

        // Filter by priority if provided
        if (priority) {
          filters.priority = priority;
        }

        const notifications = await strapi.entityService.findMany(
          "api::student-notification.student-notification",
          {
            filters,
            populate: {
              classroom: {
                populate: {
                  grade_subject: true,
                  tutors: {
                    fields: ["username", "email"],
                  },
                },
              },
              student: {
                fields: ["id", "username", "email"],
              },
            },
            fields: [
              "id",
              "title",
              "message",
              "type",
              "related_entity",
              "related_entity_id",
              "is_read",
              "is_archived",
              "action_url",
              "metadata",
              "scheduled_time",
              "priority",
              "createdAt",
              "updatedAt",
            ],
            sort: { createdAt: "desc" },
            limit: parseInt(limit),
            start: (parseInt(page) - 1) * parseInt(limit),
          }
        );

        // Count unread notifications
        const unreadCount = await strapi.entityService.count(
          "api::student-notification.student-notification",
          {
            filters: {
              ...filters,
              is_read: false,
              is_archived: false,
            },
          }
        );

        // Count by type
        const typeCounts = await Promise.all(
          [
            "class_schedule",
            "new_content",
            "announcement",
            "grade_update",
            "assignment",
            "reminder",
            "system",
          ].map(async (type) => {
            const count = await strapi.entityService.count(
              "api::student-notification.student-notification",
              {
                filters: {
                  ...filters,
                  type,
                  is_read: false,
                  is_archived: false,
                },
              }
            );
            return { type, count };
          })
        );

        return {
          data: notifications,
          meta: {
            total: notifications.length,
            unreadCount,
            typeCounts: typeCounts.reduce((acc, curr) => {
              acc[curr.type] = curr.count;
              return acc;
            }, {}),
            page: parseInt(page),
            pageSize: parseInt(limit),
          },
        };
      } catch (error) {
        console.error("Error fetching student notifications:", error);
        return ctx.badRequest("Error fetching notifications");
      }
    },

    // Mark notification as read
    async markAsRead(ctx) {
      try {
        const { id } = ctx.params;
        const user = ctx.state.user;

        if (!user) {
          return ctx.unauthorized("You must be logged in");
        }

        // Check if notification belongs to user
        const existingNotification = await strapi.entityService.findOne(
          "api::student-notification.student-notification",
          id,
          {
            populate: ["student"],
          }
        );

        if (!existingNotification) {
          return ctx.notFound("Notification not found");
        }

        if (existingNotification.student.id !== user.id) {
          return ctx.forbidden("You can only update your own notifications");
        }

        const updatedNotification = await strapi.entityService.update(
          "api::student-notification.student-notification",
          id,
          {
            data: {
              is_read: true,
            },
            populate: ["classroom", "student"],
          }
        );

        return { data: updatedNotification };
      } catch (error) {
        console.error("Error marking notification as read:", error);
        return ctx.badRequest("Error updating notification");
      }
    },

    // Mark all as read
    async markAllAsRead(ctx) {
      try {
        const user = ctx.state.user;

        if (!user) {
          return ctx.unauthorized("You must be logged in");
        }

        // Find all unread notifications for user
        const unreadNotifications = await strapi.entityService.findMany(
          "api::student-notification.student-notification",
          {
            filters: {
              student: user.id,
              is_read: false,
              is_archived: false,
            },
            fields: ["id"],
          }
        );

        // Update each notification
        const updatePromises = unreadNotifications.map((notification) =>
          strapi.entityService.update(
            "api::student-notification.student-notification",
            notification.id,
            {
              data: {
                is_read: true,
              },
            }
          )
        );

        await Promise.all(updatePromises);

        return {
          success: true,
          message: `${unreadNotifications.length} notifications marked as read`,
          count: unreadNotifications.length,
        };
      } catch (error) {
        console.error("Error marking all as read:", error);
        return ctx.badRequest("Error marking notifications as read");
      }
    },

    // Archive notification
    async archive(ctx) {
      try {
        const { id } = ctx.params;
        const user = ctx.state.user;

        if (!user) {
          return ctx.unauthorized("You must be logged in");
        }

        const existingNotification = await strapi.entityService.findOne(
          "api::student-notification.student-notification",
          id,
          {
            populate: ["student"],
          }
        );

        if (!existingNotification) {
          return ctx.notFound("Notification not found");
        }

        if (existingNotification.student.id !== user.id) {
          return ctx.forbidden("You can only archive your own notifications");
        }

        const updatedNotification = await strapi.entityService.update(
          "api::student-notification.student-notification",
          id,
          {
            data: {
              is_archived: true,
              is_read: true,
            },
          }
        );

        return { data: updatedNotification };
      } catch (error) {
        console.error("Error archiving notification:", error);
        return ctx.badRequest("Error archiving notification");
      }
    },

    // Get notification counts for badge
    async getCounts(ctx) {
      try {
        const user = ctx.state.user;

        if (!user) {
          return ctx.unauthorized("You must be logged in");
        }

        const unreadCount = await strapi.entityService.count(
          "api::student-notification.student-notification",
          {
            filters: {
              student: user.id,
              is_read: false,
              is_archived: false,
            },
          }
        );

        // Count urgent notifications
        const urgentCount = await strapi.entityService.count(
          "api::student-notification.student-notification",
          {
            filters: {
              student: user.id,
              priority: "urgent",
              is_read: false,
              is_archived: false,
            },
          }
        );

        // Count today's class schedule notifications
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const todayScheduleCount = await strapi.entityService.count(
          "api::student-notification.student-notification",
          {
            filters: {
              student: user.id,
              type: "class_schedule",
              is_read: false,
              is_archived: false,
              createdAt: {
                $gte: today.toISOString(),
                $lt: tomorrow.toISOString(),
              },
            },
          }
        );

        return {
          unread: unreadCount,
          urgent: urgentCount,
          todaySchedule: todayScheduleCount,
          total: unreadCount,
        };
      } catch (error) {
        console.error("Error getting notification counts:", error);
        return ctx.badRequest("Error getting notification counts");
      }
    },

    // Create notification (for admin/tutor use)
    async createNotification(ctx) {
      try {
        const user = ctx.state.user;
        const {
          student_id,
          title,
          message,
          type,
          classroom_id,
          metadata,
          priority = "medium",
        } = ctx.request.body;

        // Only admins/tutors can create notifications
        if (
          !user ||
          (user.role?.name !== "Administrator" && user.role?.name !== "Tutor")
        ) {
          return ctx.unauthorized(
            "Only admins and tutors can create notifications"
          );
        }

        // Verify student exists
        const student = await strapi.entityService.findOne(
          "plugin::users-permissions.user",
          student_id
        );
        if (!student) {
          return ctx.notFound("Student not found");
        }

        // Verify classroom if provided
        if (classroom_id) {
          const classroom = await strapi.entityService.findOne(
            "api::enrollment.enrollment",
            classroom_id
          );
          if (!classroom) {
            return ctx.notFound("Classroom not found");
          }

          // Check if student is enrolled in classroom
          const isEnrolled = await strapi.entityService
            .findOne("api::enrollment.enrollment", classroom_id, {
              populate: ["students"],
            })
            .then((classroom) =>
              classroom.students.some((s) => s.id === parseInt(student_id))
            );

          if (!isEnrolled) {
            return ctx.badRequest("Student is not enrolled in this classroom");
          }
        }

        const notificationData = {
          title,
          message,
          type,
          priority,
          student: student_id,
          metadata: metadata || {},
          created_by: user.id,
        };

        if (classroom_id) {
          notificationData.classroom = classroom_id;
        }

        const notification = await strapi.entityService.create(
          "api::student-notification.student-notification",
          {
            data: notificationData,
            populate: ["student", "classroom"],
          }
        );

        return { data: notification };
      } catch (error) {
        console.error("Error creating notification:", error);
        return ctx.badRequest("Error creating notification");
      }
    },

    // Bulk create notifications for classroom
    async createClassroomNotification(ctx) {
      try {
        const user = ctx.state.user;
        const {
          classroom_id,
          title,
          message,
          type,
          metadata,
          priority = "medium",
        } = ctx.request.body;

        // Only admins/tutors can create notifications
        if (
          !user ||
          (user.role?.name !== "Administrator" && user.role?.name !== "Tutor")
        ) {
          return ctx.unauthorized(
            "Only admins and tutors can create notifications"
          );
        }

        // Get classroom with students
        const classroom = await strapi.entityService.findOne(
          "api::enrollment.enrollment",
          classroom_id,
          {
            populate: ["students"],
          }
        );

        if (!classroom) {
          return ctx.notFound("Classroom not found");
        }

        if (!classroom.students || classroom.students.length === 0) {
          return ctx.badRequest("No students enrolled in this classroom");
        }

        const notifications = [];

        // Create notification for each student
        for (const student of classroom.students) {
          const notificationData = {
            title,
            message,
            type,
            priority,
            student: student.id,
            classroom: classroom_id,
            metadata: metadata || {},
            created_by: user.id,
          };

          const notification = await strapi.entityService.create(
            "api::student-notification.student-notification",
            {
              data: notificationData,
            }
          );

          notifications.push(notification);
        }

        return {
          data: notifications,
          meta: {
            count: notifications.length,
            classroom: classroom.classroom_name,
          },
        };
      } catch (error) {
        console.error("Error creating classroom notifications:", error);
        return ctx.badRequest("Error creating notifications");
      }
    },
  })
);

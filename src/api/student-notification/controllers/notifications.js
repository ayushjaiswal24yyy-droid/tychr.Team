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

        console.log("Fetching notifications for user:", user.id, user.username);

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

        console.log(
          `Found ${notifications.length} notifications for user ${user.id}`
        );

        // Count unread notifications
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
          data: notifications,
          meta: {
            total: notifications.length,
            unreadCount,
            urgentCount,
            todayScheduleCount,
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

        console.log(`Marking notification ${id} as read for user ${user.id}`);

        // Check if notification belongs to user
        const existingNotification = await strapi.entityService.findOne(
          "api::student-notification.student-notification",
          id,
          {
            populate: ["student"],
          }
        );

        if (!existingNotification) {
          console.log(`Notification ${id} not found`);
          return ctx.notFound("Notification not found");
        }

        console.log(
          "Existing notification student ID:",
          existingNotification.student?.id
        );
        console.log("Current user ID:", user.id);

        if (existingNotification.student?.id !== user.id) {
          console.log(
            `User ${user.id} cannot update notification ${id} belonging to ${existingNotification.student?.id}`
          );
          return ctx.forbidden("You can only update your own notifications");
        }

        const updatedNotification = await strapi.entityService.update(
          "api::student-notification.student-notification",
          id,
          {
            data: {
              is_read: true,
            },
          }
        );

        console.log(`Successfully marked notification ${id} as read`);
        return { data: updatedNotification };
      } catch (error) {
        console.error("Error marking notification as read:", error);
        return ctx.internalServerError("Error updating notification");
      }
    },

    // Mark all as read
    async markAllAsRead(ctx) {
      try {
        const user = ctx.state.user;

        if (!user) {
          return ctx.unauthorized("You must be logged in");
        }

        console.log(`Marking all notifications as read for user ${user.id}`);

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

        console.log(`Found ${unreadNotifications.length} unread notifications`);

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
        return ctx.internalServerError("Error marking notifications as read");
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

        console.log(`Archiving notification ${id} for user ${user.id}`);

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

        if (existingNotification.student?.id !== user.id) {
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
        return ctx.internalServerError("Error archiving notification");
      }
    },

    // Get notification counts for badge
    async getCounts(ctx) {
      try {
        const user = ctx.state.user;

        if (!user) {
          return ctx.unauthorized("You must be logged in");
        }

        console.log("Getting notification counts for user:", user.id);

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

        const counts = {
          unread: unreadCount,
          urgent: urgentCount,
          todaySchedule: todayScheduleCount,
          total: unreadCount,
        };

        console.log("Counts for user", user.id, ":", counts);
        return counts;
      } catch (error) {
        console.error("Error getting notification counts:", error);
        return ctx.internalServerError("Error getting notification counts");
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
          const classroomWithStudents = await strapi.entityService.findOne(
            "api::enrollment.enrollment",
            classroom_id,
            {
              populate: ["students"],
            }
          );

          const isEnrolled = classroomWithStudents?.students?.some(
            (s) => s.id === parseInt(student_id)
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
          }
        );

        return { data: notification };
      } catch (error) {
        console.error("Error creating notification:", error);
        return ctx.internalServerError("Error creating notification");
      }
    },
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
        return ctx.internalServerError("Error creating notifications");
      }
    },

    async createTestNotifications(ctx) {
      try {
        const user = ctx.state.user;

        if (!user) {
          return ctx.unauthorized("You must be logged in");
        }

        console.log("Creating test notifications for user:", user.id);

        // Create test notifications
        const testNotifications = [
          {
            title: "Test: Math Class Reminder",
            message: "Your Algebra class starts in 15 minutes",
            type: "class_schedule",
            priority: "urgent",
            metadata: { test: true },
          },
          {
            title: "Test: New Assignment",
            message: "Chapter 5: Quadratic Equations - Due Friday",
            type: "assignment",
            priority: "high",
            metadata: { test: true },
          },
          {
            title: "Test: Grade Updated",
            message: "Your Physics mid-term grade is now A (92%)",
            type: "grade_update",
            priority: "medium",
            metadata: { test: true },
          },
          {
            title: "Test: New Study Material",
            message: "Trigonometry formulas uploaded",
            type: "new_content",
            priority: "medium",
            metadata: { test: true },
          },
        ];

        const createdNotifications = [];

        for (const notificationData of testNotifications) {
          const notification = await strapi.entityService.create(
            "api::student-notification.student-notification",
            {
              data: {
                ...notificationData,
                student: user.id,
              },
            }
          );
          createdNotifications.push(notification);
        }

        return {
          success: true,
          message: `Created ${createdNotifications.length} test notifications`,
          notifications: createdNotifications,
        };
      } catch (error) {
        console.error("Error creating test notifications:", error);
        return ctx.internalServerError("Error creating test notifications");
      }
    },
  })
);

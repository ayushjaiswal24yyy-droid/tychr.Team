"use strict";

module.exports = ({ strapi }) => ({
  // Create notification for a student
  async createStudentNotification(studentId, data) {
    try {
      const notification = await strapi.entityService.create(
        "api::student-notification.student-notification",
        {
          data: {
            ...data,
            student: studentId,
          },
        }
      );
      return notification;
    } catch (error) {
      console.error("Error creating student notification:", error);
      return null;
    }
  },

  // Create notifications for all students in a classroom
  async createClassroomNotification(classroomId, data) {
    try {
      const classroom = await strapi.entityService.findOne(
        "api::enrollment.enrollment",
        classroomId,
        {
          populate: ["students"],
        }
      );

      if (
        !classroom ||
        !classroom.students ||
        classroom.students.length === 0
      ) {
        return [];
      }

      const notifications = [];

      for (const student of classroom.students) {
        const notification = await this.createStudentNotification(student.id, {
          ...data,
          classroom: classroomId,
        });

        if (notification) {
          notifications.push(notification);
        }
      }

      return notifications;
    } catch (error) {
      console.error("Error creating classroom notifications:", error);
      return [];
    }
  },

  // Check for upcoming classes and create notifications
  async checkUpcomingClasses() {
    try {
      const now = new Date();
      const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

      // Find classes starting in the next hour
      const upcomingLectures = await strapi.entityService.findMany(
        "api::live-lecture.live-lecture",
        {
          filters: {
            scheduled_time: {
              $gte: now.toISOString(),
              $lte: oneHourFromNow.toISOString(),
            },
          },
          populate: ["classrooms.students"],
        }
      );

      const notifications = [];

      for (const lecture of upcomingLectures) {
        if (lecture.classrooms && lecture.classrooms.length > 0) {
          for (const classroom of lecture.classrooms) {
            const existingNotifications = await strapi.entityService.findMany(
              "api::student-notification.student-notification",
              {
                filters: {
                  type: "class_schedule",
                  related_entity: "live_lecture",
                  related_entity_id: lecture.id.toString(),
                  createdAt: {
                    $gte: new Date(
                      now.getTime() - 30 * 60 * 1000
                    ).toISOString(), // Last 30 minutes
                  },
                },
              }
            );

            // Only create if no notification exists in last 30 minutes
            if (existingNotifications.length === 0) {
              const classNotifications = await this.createClassroomNotification(
                classroom.id,
                {
                  title: "Upcoming Class",
                  message: `Class "${lecture.title}" starts at ${new Date(
                    lecture.scheduled_time
                  ).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}`,
                  type: "class_schedule",
                  priority: "high",
                  related_entity: "live_lecture",
                  related_entity_id: lecture.id.toString(),
                  action_url: `dashboard/student/my-classrooms/${classroom.id}/live/`,
                  metadata: {
                    lecture_id: lecture.id,
                    start_time: lecture.scheduled_time,
                    duration: lecture.duration,
                  },
                }
              );

              notifications.push(...classNotifications);
            }
          }
        }
      }

      return notifications;
    } catch (error) {
      console.error("Error checking upcoming classes:", error);
      return [];
    }
  },

  // Check for today's schedule
  async checkTodaysSchedule() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Find today's lectures
      const todayLectures = await strapi.entityService.findMany(
        "api::live-lecture.live-lecture",
        {
          filters: {
            scheduled_time: {
              $gte: today.toISOString(),
              $lt: tomorrow.toISOString(),
            },
          },
          populate: ["classrooms.students"],
        }
      );

      const notifications = [];

      // Create morning notification for today's classes
      const morningTime = new Date();
      morningTime.setHours(8, 0, 0, 0); // 8 AM

      if (
        now > morningTime &&
        now < new Date(morningTime.getTime() + 60 * 60 * 1000)
      ) {
        for (const lecture of todayLectures) {
          if (lecture.classrooms && lecture.classrooms.length > 0) {
            for (const classroom of lecture.classrooms) {
              const existingNotifications = await strapi.entityService.findMany(
                "api::student-notification.student-notification",
                {
                  filters: {
                    type: "reminder",
                    related_entity: "daily_schedule",
                    related_entity_id: `${classroom.id}-${
                      today.toISOString().split("T")[0]
                    }`,
                    createdAt: {
                      $gte: today.toISOString(),
                    },
                  },
                }
              );

              if (existingNotifications.length === 0) {
                const classNotifications =
                  await this.createClassroomNotification(classroom.id, {
                    title: "Today's Schedule",
                    message: `You have classes scheduled today in ${classroom.classroom_name}`,
                    type: "reminder",
                    priority: "medium",
                    related_entity: "daily_schedule",
                    related_entity_id: `${classroom.id}-${
                      today.toISOString().split("T")[0]
                    }`,
                    action_url: `resources/classroom/${classroom.id}/live`,
                    metadata: {
                      date: today.toISOString(),
                      classroom_id: classroom.id,
                    },
                  });

                notifications.push(...classNotifications);
              }
            }
          }
        }
      }

      return notifications;
    } catch (error) {
      console.error("Error checking today's schedule:", error);
      return [];
    }
  },

  // Create notification for new content
  async notifyNewContent(classroomId, contentType, contentId, contentTitle) {
    try {
      const notifications = await this.createClassroomNotification(
        classroomId,
        {
          title: "New Content Available",
          message: `New ${contentType}: "${contentTitle}" has been added`,
          type: "new_content",
          priority: "medium",
          related_entity: contentType,
          related_entity_id: contentId.toString(),
          action_url: `dashboard/student/my-classrooms/${classroomId}/resources`,
          metadata: {
            content_type: contentType,
            content_id: contentId,
            content_title: contentTitle,
          },
        }
      );

      return notifications;
    } catch (error) {
      console.error("Error creating new content notification:", error);
      return [];
    }
  },

  // Create notification for new announcement
  async notifyNewAnnouncement(classroomId, announcement) {
    try {
      const notifications = await this.createClassroomNotification(
        classroomId,
        {
          title: "New Announcement",
          message: announcement.title || "New announcement posted",
          type: "announcement",
          priority: "high",
          related_entity: "announcement",
          related_entity_id: announcement.id?.toString() || "",
          action_url: `dashboard/student/my-classrooms/${classroomId}`,
          metadata: {
            announcement_id: announcement.id,
            announcement_title: announcement.title,
          },
        }
      );

      return notifications;
    } catch (error) {
      console.error("Error creating announcement notification:", error);
      return [];
    }
  },
});

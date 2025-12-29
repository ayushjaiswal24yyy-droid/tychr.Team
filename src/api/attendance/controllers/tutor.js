"use strict";

module.exports = {
  async bulkUpdate(ctx) {
    try {
      const { attendanceUpdates } = ctx.request.body;

      if (!Array.isArray(attendanceUpdates)) {
        return ctx.badRequest("attendanceUpdates must be an array");
      }

      const updatedAttendances = await Promise.all(
        attendanceUpdates.map(async (update) => {
          return await strapi.entityService.update(
            "api::attendance.attendance",
            update.id,
            { data: update.data }
          );
        })
      );

      return { data: updatedAttendances };
    } catch (error) {
      return ctx.badRequest("Error updating attendance", error);
    }
  },

  async initializeForLecture(ctx) {
    try {
      const { lectureId, classroomId } = ctx.request.body;

      if (!lectureId || !classroomId) {
        return ctx.badRequest("lectureId and classroomId are required");
      }

      // Get classroom with students
      const classroom = await strapi.entityService.findOne(
        "api::enrollment.enrollment",
        classroomId,
        {
          populate: ["students"],
        }
      );

      if (!classroom) {
        return ctx.notFound("Classroom not found");
      }

      // Check if lecture exists
      const lecture = await strapi.entityService.findOne(
        "api::live-lecture.live-lecture",
        lectureId
      );

      if (!lecture) {
        return ctx.notFound("Lecture not found");
      }

      // Create attendance records for each student
      const createdAttendances = [];
      const students = classroom.students || [];

      for (const student of students) {
        // Check if attendance already exists
        const existingAttendance = await strapi.db
          .query("api::attendance.attendance")
          .findOne({
            where: {
              student: student.id,
              live_lecture: lectureId,
            },
          });

        if (!existingAttendance) {
          const attendance = await strapi.entityService.create(
            "api::attendance.attendance",
            {
              data: {
                student: student.id,
                live_lecture: lectureId,
                status: "pending",
                marked_at: new Date(),
                marked_by: "system",
              },
            }
          );
          createdAttendances.push(attendance);
        }
      }

      return {
        success: true,
        message: `Created ${createdAttendances.length} attendance records`,
        data: createdAttendances,
      };
    } catch (error) {
      console.error("Error initializing attendance:", error);
      return ctx.badRequest("Error initializing attendance", error);
    }
  },

  async getLectureAttendance(ctx) {
    try {
      const { lectureId } = ctx.params;

      const attendances = await strapi.entityService.findMany(
        "api::attendance.attendance",
        {
          filters: {
            live_lecture: lectureId,
          },
          populate: ["student", "live_lecture"],
          sort: { createdAt: "desc" },
        }
      );

      return { data: attendances };
    } catch (error) {
      console.error("Error fetching lecture attendance:", error);
      return ctx.badRequest("Error fetching attendance", error);
    }
  },


};

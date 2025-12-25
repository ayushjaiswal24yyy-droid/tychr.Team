"use strict";

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::enrollment.enrollment",
  ({ strapi }) => ({
    async createCustomClassroom(ctx) {
      try {
        const { data } = ctx.request.body;

        if (!data) {
          return ctx.badRequest("No data provided");
        }

        // 1. Validate required fields from your schema
        const requiredFields = [
          "classroom_name",
          "startDate",
          "endDate",
          "price",
          "classroom_type",
          "days",
          "grade_subject",
          "topic",
          "duration",
          "ib_program",
          "grade",
        ];

        const missingFields = requiredFields.filter(
          (field) => !data[field] && data[field] !== 0
        );

        if (missingFields.length > 0) {
          return ctx.badRequest(
            `Missing required fields: ${missingFields.join(", ")}`
          );
        }

        // 2. Validate topic exists and belongs to correct grade_subject
        if (data.topic) {
          const topic = await strapi.entityService.findOne(
            "api::subtopic.subtopic",
            data.topic,
            {
              populate: ["topic.grade_subject"],
            }
          );

          if (!topic) {
            return ctx.badRequest("Invalid topic selected");
          }

          // Check if topic's grade_subject matches the provided grade_subject
          if (topic.topic?.grade_subject?.id !== parseInt(data.grade_subject)) {
            return ctx.badRequest(
              "Topic does not belong to the selected subject"
            );
          }
        }

        // 3. Validate grade_subject exists
        if (data.grade_subject) {
          const gradeSubject = await strapi.entityService.findOne(
            "api::grade-subject.grade-subject",
            data.grade_subject,
            {
              populate: ["grade", "subject"],
            }
          );

          if (!gradeSubject) {
            return ctx.badRequest("Invalid subject selected");
          }

          // Check if grade matches
          if (gradeSubject.grade?.id !== parseInt(data.grade)) {
            return ctx.badRequest(
              "Subject does not belong to the selected grade"
            );
          }
        }

        // 4. Validate grade exists
        if (data.grade) {
          const grade = await strapi.entityService.findOne(
            "api::class.class",
            data.grade
          );
          if (!grade) {
            return ctx.badRequest("Invalid grade selected");
          }
        }

        // 5. Validate IB program exists and contains the grade
        if (data.ib_program) {
          const ibProgram = await strapi.entityService.findOne(
            "api::ib-program.ib-program",
            data.ib_program,
            {
              populate: ["grades"],
            }
          );

          if (!ibProgram) {
            return ctx.badRequest("Invalid IB program selected");
          }

          // Check if grade is in the IB program
          const hasGrade = ibProgram.grades?.some(
            (g) => g.id === parseInt(data.grade)
          );
          if (!hasGrade) {
            return ctx.badRequest(
              "Selected grade is not available in this IB program"
            );
          }
        }

        // 6. Validate classroom type specific rules
        if (data.classroom_type === "group") {
          if (
            !data.group_limit ||
            data.group_limit < 2 ||
            data.group_limit > 10
          ) {
            return ctx.badRequest(
              "Group classes must have a limit between 2 and 50 students"
            );
          }
        } else if (data.classroom_type === "one-on-one") {
          data.group_limit = null; // Clear group limit for one-on-one
        }

        // 7. Validate date range
        const startDate = new Date(data.startDate);
        const endDate = new Date(data.endDate);

        if (startDate >= endDate) {
          return ctx.badRequest("End date must be after start date");
        }

        // 8. Validate duration
        if (data.duration < 30 || data.duration > 180) {
          return ctx.badRequest("Duration must be between 30 and 180 minutes");
        }

        // 9. Validate days structure
        if (!Array.isArray(data.days) || data.days.length === 0) {
          return ctx.badRequest("At least one day must be selected");
        }

        // Validate each day object
        if (!Array.isArray(data.days) || data.days.length === 0) {
          return ctx.badRequest("At least one day must be selected");
        }

        const VALID_DAYS = [
          "monday",
          "tuesday",
          "wednesday",
          "thursday",
          "friday",
          "saturday",
          "sunday",
        ];

        for (const d of data.days) {
          if (!VALID_DAYS.includes(d.days)) {
            return ctx.badRequest(`Invalid day: ${d.days}`);
          }

          if (
            !d.startTime ||
            !/^([01]\d|2[0-3]):[0-5]\d$/.test(d.startTime)
          ) {
            return ctx.badRequest(
              `Invalid time format for ${d.days}. Use HH:mm`
            );
          }
        }


        // 10. Validate price
        if (data.price < 0) {
          return ctx.badRequest("Price must be a positive number");
        }

        // 11. Validate assistant if isAssist is true
        if (data.isAssist && data.assistant) {
          const assistant = await strapi.entityService.findOne(
            "plugin::users-permissions.user",
            data.assistant
          );
          if (!assistant) {
            return ctx.badRequest("Invalid assistant selected");
          }

          // Check if assistant has appropriate role (optional)
          const assistantRole = assistant.role?.name;
          if (!["tutor", "assistant", "admin"].includes(assistantRole)) {
            return ctx.badRequest(
              "Selected assistant does not have appropriate permissions"
            );
          }
        } else if (data.isAssist && !data.assistant) {
          return ctx.badRequest(
            "Assistant is required when assistant is enabled"
          );
        }

        // 12. Get current user (tutor) from context
        const user = ctx.state.user;
        if (!user) {
          return ctx.unauthorized(
            "You must be logged in to create a classroom"
          );
        }

        // 13. Check if tutor has reached classroom limit
        const tutorClassrooms = await strapi.entityService.findMany(
          "api::enrollment.enrollment",
          {
            filters: {
              tutor: user.id,
              $or: [{ status: "Approved" }, { status: "Requested" }],
            },
          }
        );

        // Get tutor's classroom limit from user profile (adjust based on your user schema)
        const tutorProfile = await strapi.entityService.findOne(
          "plugin::users-permissions.user",
          user.id,
          {
            populate: ["tutor_profile"],
          }
        );

        const classroomLimit =
          tutorProfile?.tutor_profile?.classroom_limit || 5; // Default to 5 if not set

        if (tutorClassrooms.length >= classroomLimit) {
          return ctx.badRequest(
            `You have reached your classroom limit of ${classroomLimit}. Please upgrade your plan or contact support.`
          );
        }

        // 14. Prepare the classroom data
        const classroomData = {
          data: {
            ...data,
            tutor: user.id, // Set the tutor
            enrollment_date: new Date().toISOString().split("T")[0], // Today's date
            status: "Requested", // Default status
            isPaid: true,
            payment_date: null,
            // Set default values for optional fields
            isAssist: data.isAssist || false,
            assistant: data.isAssist ? data.assistant : null,
            group_limit:
              data.classroom_type === "group" ? data.group_limit : null,
            // Ensure proper data types
            price: parseFloat(data.price),
            duration: parseInt(data.duration),
            startDate: new Date(data.startDate).toISOString().split("T")[0],
            endDate: new Date(data.endDate).toISOString().split("T")[0],
            // Convert days component properly
            days: data.days.map((day) => ({
              days: day.day.toLowerCase(),
              startTime: day.time,
            })),
          },
        };

        // 15. Create the classroom
        const classroom = await strapi.entityService.create(
          "api::enrollment.enrollment",
          classroomData
        );

        // 16. Send notification (optional)
        try {
          await strapi
            .service("api::notification.notification")
            .sendClassroomCreationNotification({
              classroom,
              tutor: user,
            });
        } catch (notificationError) {
          // Don't fail if notification fails
          strapi.log.error("Failed to send notification:", notificationError);
        }

        return {
          success: true,
          data: classroom,
          message: "Classroom created successfully and submitted for approval",
        };
      } catch (error) {
        strapi.log.error("Error creating classroom:", error);
        return ctx.badRequest(
          error.message || "An error occurred while creating the classroom"
        );
      }
    },

    // Optional: Add a validation endpoint for frontend
    async validateClassroomData(ctx) {
      try {
        const { data } = ctx.request.body;

        if (!data) {
          return ctx.badRequest("No data provided");
        }

        const validationErrors = [];

        // Validate topic
        if (data.topic) {
          const topic = await strapi.entityService.findOne(
            "api::subtopic.subtopic",
            data.topic,
            {
              populate: ["topic.grade_subject"],
            }
          );

          if (!topic) {
            validationErrors.push("Invalid topic selected");
          } else if (
            data.grade_subject &&
            topic.topic?.grade_subject?.id !== parseInt(data.grade_subject)
          ) {
            validationErrors.push(
              "Topic does not belong to the selected subject"
            );
          }
        }

        // Validate grade_subject
        if (data.grade_subject) {
          const gradeSubject = await strapi.entityService.findOne(
            "api::grade-subject.grade-subject",
            data.grade_subject,
            {
              populate: ["grade"],
            }
          );

          if (!gradeSubject) {
            validationErrors.push("Invalid subject selected");
          } else if (
            data.grade &&
            gradeSubject.grade?.id !== parseInt(data.grade)
          ) {
            validationErrors.push(
              "Subject does not belong to the selected grade"
            );
          }
        }

        // Validate IB program and grade compatibility
        if (data.ib_program && data.grade) {
          const ibProgram = await strapi.entityService.findOne(
            "api::ib-program.ib-program",
            data.ib_program,
            {
              populate: ["grades"],
            }
          );

          if (ibProgram) {
            const hasGrade = ibProgram.grades?.some(
              (g) => g.id === parseInt(data.grade)
            );
            if (!hasGrade) {
              validationErrors.push(
                "Selected grade is not available in this IB program"
              );
            }
          }
        }

        return {
          valid: validationErrors.length === 0,
          errors: validationErrors,
        };
      } catch (error) {
        return ctx.badRequest(error.message);
      }
    },
    async updateCustomClassroom(ctx) {
      try {
        const { id } = ctx.params;
        const { data } = ctx.request.body;

        if (!id) {
          return ctx.badRequest("Classroom ID is required");
        }

        if (!data) {
          return ctx.badRequest("No data provided for update");
        }

        const user = ctx.state.user;
        if (!user) {
          return ctx.unauthorized(
            "You must be logged in to update a classroom"
          );
        }

        // 1. Get the existing classroom
        const existingClassroom = await strapi.entityService.findOne(
          "api::enrollment.enrollment",
          id,
          {
            populate: [
              "status",
              "tutor",
              "grade_subject",
              "topic",
              "grade",
              "ib_program",
            ],
          }
        );

        //  Check if user is the tutor or has admin rights
        if (existingClassroom.tutor?.id !== user.id) {
          return ctx.forbidden("You can only update your own classrooms");
        }
        if (!existingClassroom) {
          return ctx.notFound("Classroom not found");
        }

        // 2. Prevent updates if status is "Approved" (except certain fields)
        const editableStatuses = ["Requested", "Requested Demo", "Responded"];
        if (
          existingClassroom.status === "Approved" &&
          !editableStatuses.includes(data.status)
        ) {
          // For approved classrooms, only allow updates to specific fields
          const allowedFields = [
            "notices",
            "additional_resources",
            "recorded_lectures",
          ];

          const attemptedUpdates = Object.keys(data);
          const disallowedUpdates = attemptedUpdates.filter(
            (field) => !allowedFields.includes(field)
          );

          if (disallowedUpdates.length > 0) {
            return ctx.badRequest(
              `Cannot update ${disallowedUpdates.join(
                ", "
              )} for approved classrooms. ` +
              "Only notices and additional resources can be updated."
            );
          }
        }

        // 3. Validate topic if being updated
        if (data.topic) {
          const topic = await strapi.entityService.findOne(
            "api::subtopic.subtopic",
            data.topic,
            {
              populate: ["topic.grade_subject"],
            }
          );

          if (!topic) {
            return ctx.badRequest("Invalid topic selected");
          }

          // Check if topic's grade_subject matches the classroom's grade_subject
          if (
            existingClassroom.grade_subject?.id &&
            topic.topic?.grade_subject?.id !==
            existingClassroom.grade_subject.id
          ) {
            return ctx.badRequest(
              "Topic does not belong to the classroom's garde subject"
            );
          }
        }

        // 4. Validate grade_subject if being updated
        if (data.grade_subject) {
          const gradeSubject = await strapi.entityService.findOne(
            "api::grade-subject.grade-subject",
            data.grade_subject,
            {
              populate: ["grade"],
            }
          );

          if (!gradeSubject) {
            return ctx.badRequest("Invalid grade subject selected");
          }

          // Check if grade matches existing grade
          if (
            existingClassroom.grade?.id &&
            gradeSubject.grade?.id !== existingClassroom.grade.id
          ) {
            return ctx.badRequest(
              "Grade subject does not belong to the classroom's grade subject"
            );
          }
        }

        // 5. Validate grade if being updated
        if (data.grade) {
          const grade = await strapi.entityService.findOne(
            "api::class.class",
            data.grade
          );
          if (!grade) {
            return ctx.badRequest("Invalid grade selected");
          }
        }

        // 6. Validate IB program if being updated
        if (data.ib_program) {
          const ibProgram = await strapi.entityService.findOne(
            "api::ib-program.ib-program",
            data.ib_program,
            {
              populate: ["grades"],
            }
          );

          if (!ibProgram) {
            return ctx.badRequest("Invalid IB program selected");
          }

          // Check if grade is in the IB program
          const currentGradeId = data.grade || existingClassroom.grade?.id;
          if (currentGradeId) {
            const hasGrade = ibProgram.grades?.some(
              (g) => g.id === parseInt(currentGradeId)
            );
            if (!hasGrade) {
              return ctx.badRequest(
                "Selected grade is not available in this IB program"
              );
            }
          }
        }

        // 7. Validate classroom type specific rules
        if (data.classroom_type) {
          if (data.classroom_type === "group") {
            if (
              !data.group_limit ||
              data.group_limit < 2 ||
              data.group_limit > 50
            ) {
              return ctx.badRequest(
                "Group classes must have a limit between 2 and 50 students"
              );
            }
          } else if (data.classroom_type === "one-on-one") {
            data.group_limit = null;
          }
        }

        // 8. Validate date range if dates are being updated
        if (data.startDate || data.endDate) {
          const startDate = new Date(
            data.startDate || existingClassroom.startDate
          );
          const endDate = new Date(data.endDate || existingClassroom.endDate);

          if (startDate >= endDate) {
            return ctx.badRequest("End date must be after start date");
          }
        }

        // 9. Validate duration if being updated
        if (data.duration && data.duration < 30) {
          return ctx.badRequest("Duration must be at least 30 minutes");
        }

        // 10. Validate days if being updated

        if (data.days) {
          if (!Array.isArray(data.days) || data.days.length === 0) {
            return ctx.badRequest("At least one day must be selected");
          }

          const validDays = [
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
          ];

          for (const day of data.days) {
            if (!day.days || !validDays.includes(day.days)) {
              return ctx.badRequest(
                `Invalid day: ${day.days}. Must be one of: ${validDays.join(
                  ", "
                )}`
              );
            }
            // ACCEPT HH:mm:ss.SSS format (what you're sending from frontend)
            if (
              !day.startTime ||
              !/^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d)(\.\d{3})?)?$/.test(
                day.startTime
              )
            ) {
              return ctx.badRequest(
                `Invalid time format for ${day.days}. Use HH:mm or HH:mm:ss.SSS format`
              );
            }
          }
        }

        // 11. Validate price if being updated
        if (data.price !== undefined && data.price < 0) {
          return ctx.badRequest("Price must be a positive number");
        }

        // 12. Validate assistant if isAssist is being updated
        // if (data.isAssist !== undefined) {
        //   if (data.isAssist && data.assistant) {
        //     const assistant = await strapi.entityService.findOne(
        //       "plugin::users-permissions.user",
        //       data.assistant
        //     );
        //     if (!assistant) {
        //       return ctx.badRequest("Invalid assistant selected");
        //     }

        //     const assistantRole = assistant.role?.name;
        //     if (!["tutor", "assistant", "admin"].includes(assistantRole)) {
        //       return ctx.badRequest(
        //         "Selected assistant does not have appropriate permissions"
        //       );
        //     }
        //   } else if (
        //     data.isAssist &&
        //     !data.assistant &&
        //     !existingClassroom.assistant
        //   ) {
        //     return ctx.badRequest(
        //       "Assistant is required when assistant is enabled"
        //     );
        //   }
        // }

        // 15. Prepare update data with proper transformations
        // 10. Validate days if being updated - FIXED VERSION
        if (data.days) {
          if (!Array.isArray(data.days) || data.days.length === 0) {
            return ctx.badRequest("At least one day must be selected");
          }

          const validDays = [
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
          ];

          for (const day of data.days) {
            if (!day.days || !validDays.includes(day.days)) {
              return ctx.badRequest(
                `Invalid day: ${day.days}. Must be one of: ${validDays.join(
                  ", "
                )}`
              );
            }

          }
        }

        // 15. Prepare update data with proper transformations - FIXED VERSION
        const updateData = {
          ...data,
          ...(data.price !== undefined && { price: parseFloat(data.price) }),
          ...(data.duration !== undefined && {
            duration: parseInt(data.duration),
          }),
          ...(data.startDate && {
            startDate: new Date(data.startDate).toISOString().split("T")[0],
          }),
          ...(data.endDate && {
            endDate: new Date(data.endDate).toISOString().split("T")[0],
          }),
          ...(data.days && {
            days: data.days.map((day) => ({
              days: day.days, // Keep uppercase as per enum
              startTime: day.startTime, // Keep startTime field
            })),
          }),
          ...(data.additional_resources && {
            additional_resources: data.additional_resources,
          }),
          // Handle assistant properly
        };

        delete updateData.grade_subject;
        delete updateData.topic;
        delete updateData.ib_program;
        delete updateData.grade;

        // 16. Update the classroom
        const updatedClassroom = await strapi.entityService.update(
          "api::enrollment.enrollment",
          id,
          {
            data: updateData,
            populate: [
              "tutor",
              "grade_subject",
              "topic",
              "grade",
              "ib_program",
              "assistant",
              "students",
            ],
          }
        );


        return {
          success: true,
          data: updatedClassroom,
          message: "Classroom updated successfully",
        };
      } catch (error) {
        strapi.log.error("Error updating classroom:", error);
        return ctx.badRequest(
          error.message || "An error occurred while updating the classroom"
        );
      }
    },
  })
);

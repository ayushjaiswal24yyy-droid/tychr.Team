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
        const validDays = [
          "monday",
          "tuesday",
          "wednesday",
          "thursday",
          "friday",
          "saturday",
          "sunday",
        ];
        for (const day of data.days) {
          if (!day.day || !validDays.includes(day.day.toLowerCase())) {
            return ctx.badRequest(
              `Invalid day: ${day.day}. Must be one of: ${validDays.join(", ")}`
            );
          }
          if (
            !day.time ||
            !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(day.time)
          ) {
            return ctx.badRequest(
              `Invalid time format for ${day.day}. Use HH:MM format`
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
            isPaid: false, // Default to not paid
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
              day: day.day.toLowerCase(),
              time: day.time,
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

        console.log("Update request received for ID:", id);

        if (!id) {
          return ctx.badRequest("Classroom ID is required");
        }

        if (!data) {
          return ctx.badRequest("No data provided for update");
        }

        const user = ctx.state.user;
        if (!user) {
          return ctx.unauthorized("You must be logged in to update a classroom");
        }

        // Get the existing classroom
        const existingClassroom = await strapi.entityService.findOne(
          "api::enrollment.enrollment",
          id,
          {
            populate: ["status", "tutor"],
          }
        );

        if (!existingClassroom) {
          return ctx.notFound("Classroom not found");
        }

        // Check if user is the tutor
        if (existingClassroom.tutor?.id !== user.id) {
          return ctx.forbidden("You can only update your own classrooms");
        }

        // Check if classroom is approved and restrict updates
        if (existingClassroom.status === "Approved") {
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
                "Only notices, additional resources, and lectures can be updated."
            );
          }
        }

        // Prepare update data - ONLY include what's in the request
        const updateData = {};

        // Handle component fields
        if (data.notices !== undefined) {
          updateData.notices = Array.isArray(data.notices) 
            ? data.notices.map((notice) => ({
                title: notice.title || "",
                content: notice.content || "",
                date: notice.date || new Date().toISOString(),
              }))
            : data.notices;
        }

        if (data.days !== undefined) {
          updateData.days = Array.isArray(data.days) 
            ? data.days.map((day) => ({
                day: (day.days || "").toLowerCase(),
                time: day.startTime || "09:00",
              }))
            : data.days;
        }

        // Handle simple scalar fields
        const scalarFields = [
          "classroom_name",
          "duration",
          "price",
          "isPaid",
          "isAssist",
          "group_limit",
          "startDate",
          "endDate",
          "status",
          "classroom_type",
        ];

        scalarFields.forEach((field) => {
          if (data[field] !== undefined) {
            updateData[field] = data[field];
          }
        });

        // Handle relational fields ONLY if provided
        const relationalFields = ["assistant", "tutor"];
        relationalFields.forEach((field) => {
          if (data[field] !== undefined) {
            if (data[field] === null) {
              updateData[field] = null;
            } else if (typeof data[field] === "number") {
              updateData[field] = { id: data[field] };
            } else if (data[field]?.id) {
              updateData[field] = { id: data[field].id };
            }
          }
        });

        // Convert dates if present
        if (updateData.startDate) {
          updateData.startDate = new Date(updateData.startDate).toISOString().split("T")[0];
        }
        if (updateData.endDate) {
          updateData.endDate = new Date(updateData.endDate).toISOString().split("T")[0];
        }

        // Convert numeric fields
        if (updateData.duration !== undefined) {
          updateData.duration = parseInt(updateData.duration);
        }
        if (updateData.price !== undefined) {
          updateData.price = parseFloat(updateData.price);
        }
        if (updateData.group_limit !== undefined) {
          updateData.group_limit = parseInt(updateData.group_limit);
        }

        console.log("Final update data:", updateData);

        // Update the classroom
        const updatedClassroom = await strapi.entityService.update(
          "api::enrollment.enrollment",
          id,
          {
            data: updateData,
          }
        );

        return {
          success: true,
          data: updatedClassroom,
          message: "Classroom updated successfully",
        };
      } catch (error) {
        console.error("Error updating classroom:", error);
        
        // Fix the error message extraction
        let errorMessage = "An error occurred while updating the classroom";
        
        if (error.message) {
          errorMessage = error.message;
        } else if (error.error?.message) {
          errorMessage = error.error.message;
        }
        
        return ctx.badRequest(errorMessage);
      }
    },

    // Simple check permissions endpoint
    async checkUpdatePermissions(ctx) {
      try {
        const { id } = ctx.params;

        if (!id) {
          return ctx.badRequest("Classroom ID is required");
        }

        const user = ctx.state.user;
        if (!user) {
          return ctx.unauthorized("You must be logged in");
        }

        const classroom = await strapi.entityService.findOne(
          "api::enrollment.enrollment",
          id,
          {
            populate: ["status", "tutor"],
          }
        );

        if (!classroom) {
          return ctx.notFound("Classroom not found");
        }

        const isOwner = classroom.tutor?.id === user.id;
        const isAdmin = user.role?.name === "Admin";
        const isApproved = classroom.status === "Approved";

        return {
          canUpdate: isOwner || isAdmin,
          isOwner,
          isAdmin,
          isApproved,
          status: classroom.status,
          allowedFields: isApproved
            ? [
                "notices",
                "additional_resources",
                "recorded_lectures",
                "live_lectures",
                "demo_video",
              ]
            : null,
        };
      } catch (error) {
        return ctx.badRequest(error.message);
      }
    },
  })
);

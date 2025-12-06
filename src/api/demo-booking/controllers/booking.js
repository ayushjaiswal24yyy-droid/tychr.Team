"use strict";

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::demo-booking.demo-booking",
  ({ strapi }) => ({
    async create(ctx) {
      try {
        const { user } = ctx.state;
        const data = ctx.request.body;

        // Set created_by to current user
        data.created_by = user.id;

        // Check if tutor is available at the requested time
        if (data.tutor && data.booking_date) {
          const bookingDate = new Date(data.booking_date);
          const tutorId =
            typeof data.tutor === "object" ? data.tutor.id : data.tutor;

          const tutor = await strapi.entityService.findOne(
            "plugin::users-permissions.user",
            tutorId,
            { populate: ["mentor_availabilities"] }
          );

          if (!tutor) {
            return ctx.badRequest("Tutor not found");
          }

          // Check availability using mentor_availabilities
          const dayOfWeek = bookingDate.toLocaleDateString("en-US", {
            weekday: "long",
          });
          const time = bookingDate.toTimeString().slice(0, 5);

          // Check if tutor has any availability records
          if (
            !tutor.mentor_availabilities ||
            tutor.mentor_availabilities.length === 0
          ) {
            return ctx.badRequest("Tutor has no availability set");
          }

          // Check availability for the specific day
          const isAvailable = await checkTutorAvailability(
            tutorId,
            bookingDate
          );

          if (!isAvailable) {
            return ctx.badRequest(
              "Tutor is not available at the requested time"
            );
          }
        }

        // Create the demo booking
        const demoBooking = await strapi.entityService.create(
          "api::demo-booking.demo-booking",
          {
            data: {
              ...data,
              student: data.student?.id || data.student,
              tutor: data.tutor?.id || data.tutor,
              enrollment: data.enrollment?.id || data.enrollment,
              grade_subject: data.grade_subject?.id || data.grade_subject,
              created_by: user.id,
            },
            populate: [
              "student",
              "tutor",
              "enrollment",
              "grade_subject",
              "created_by",
            ],
          }
        );

        // Update notification status to "Demo Booking" for this user
        await updateNotificationStatus(
          demoBooking.student.id,
          "Demo Booking",
          demoBooking
        );

        // Send notification emails
        // await sendDemoBookingEmails(demoBooking);

        return ctx.send({
          message: "Demo booked successfully!",
          demoBooking,
        });
      } catch (error) {
        console.error("Demo booking error:", error);
        return ctx.badRequest("Failed to create demo booking", {
          error: error.message,
        });
      }
    },

    async find(ctx) {
      try {
        const { query } = ctx;
        const { user } = ctx.state;

        // Add filters based on user role
        if (user.role.type === "student") {
          query.filters = { ...query.filters, student: user.id };
        } else if (user.role.type === "tutor") {
          query.filters = { ...query.filters, tutor: user.id };
        }

        const demoBookings = await strapi.entityService.findMany(
          "api::demo-booking.demo-booking",
          {
            ...query,
            populate: [
              "student",
              "tutor",
              "enrollment",
              "grade_subject",
              "created_by",
            ],
          }
        );

        return demoBookings;
      } catch (error) {
        return ctx.badRequest("Failed to fetch demo bookings", {
          error: error.message,
        });
      }
    },

    async getTutorAvailability(ctx) {
      try {
        const { tutorId, date } = ctx.params;

        const tutor = await strapi.entityService.findOne(
          "plugin::users-permissions.user",
          tutorId,
          { populate: ["mentor_availabilities"] }
        );

        if (!tutor) {
          return ctx.notFound("Tutor not found");
        }

        // Get existing bookings for the date
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const existingBookings = await strapi.entityService.findMany(
          "api::demo-booking.demo-booking",
          {
            filters: {
              tutor: tutorId,
              booking_date: {
                $gte: startOfDay.toISOString(),
                $lte: endOfDay.toISOString(),
              },
              status: {
                $in: ["Requested", "Confirmed"],
              },
            },
          }
        );

        // Get tutor availability
        const dayOfWeek = new Date(date).toLocaleDateString("en-US", {
          weekday: "long",
        });
        const availability = await getTutorDayAvailability(tutorId, dayOfWeek);

        // Calculate available slots
        const availableSlots = await calculateAvailableSlots(
          availability,
          existingBookings,
          date
        );

        return ctx.send({
          tutor: {
            id: tutor.id,
            fullName: tutor.fullName,
            avatar: tutor.avatar,
          },
          date,
          availability,
          availableSlots,
        });
      } catch (error) {
        return ctx.badRequest("Failed to fetch tutor availability", {
          error: error.message,
        });
      }
    },

    async updateStatus(ctx) {
      try {
        const { id } = ctx.params;
        const { status, meeting_link } = ctx.request.body;

        const demoBooking = await strapi.entityService.update(
          "api::demo-booking.demo-booking",
          id,
          {
            data: {
              status,
              ...(meeting_link && { meeting_link }),
            },
            populate: ["student", "tutor"],
          }
        );

        // Send status update emails
        // await sendStatusUpdateEmail(demoBooking);

        return ctx.send({
          message: "Demo booking status updated successfully",
          demoBooking,
        });
      } catch (error) {
        return ctx.badRequest("Failed to update demo booking status", {
          error: error.message,
        });
      }
    },
 async findByStudent(ctx) {
  try {
    const { studentId } = ctx.params;

    // Validate studentId
    if (!studentId) {
      return ctx.badRequest("Student ID is required");
    }

    // Validate if studentId is a valid number
    if (isNaN(studentId)) {
      return ctx.badRequest("Invalid Student ID format");
    }

    const demoBookings = await strapi.entityService.findMany(
      "api::demo-booking.demo-booking",
      {
        filters: {
          student: {
            id: studentId
          }
        },
        populate: {
          student: {
            fields: ["id", "username", "email", "firstName", "lastName"],
            populate: {
              avatar: {
                fields: ["url", "formats"]
              }
            }
          },
          tutor: {
            fields: ["id", "username", "email", "firstName", "lastName"],
            populate: {
              avatar: {
                fields: ["url", "formats"]
              }
            }
          },
          grade_subject: {
            fields: ["id", "name", "level"],
            populate: {
              subject: {
                fields: ["id", "name"]
              },
              grade: {
                fields: ["id", "name"]
              }
            }
          },
          enrollment: {
            fields: ["id", "status", "startDate", "classroom_name"],
            populate: {
              grade_subject: {
                fields: ["id", "name"]
              }
            }
          },
          created_by: {
            fields: ["id", "username", "email"]
          }
        },
        fields: [
          "id",
          "booking_date",
          "status",
          "duration",
          "notes",
          "meeting_link",
          "createdAt",
          "updatedAt"
        ],
        sort: { booking_date: "desc" },
      }
    );

    // Transform the response to handle any potential issues
    const transformedBookings = demoBookings.map(booking => ({
      ...booking,
      // Ensure dates are properly formatted
      booking_date: booking.booking_date ? new Date(booking.booking_date).toISOString() : null,
      // Handle potential null relations
      student: booking.student || null,
      tutor: booking.tutor || null,
      grade_subject: booking.grade_subject || null,
      enrollment: booking.enrollment || null
    }));

    return transformedBookings;
    
  } catch (error) {
    console.error("Error in findByStudent:", error);
    
    // More detailed error response
    if (error.message.includes("relation") || error.message.includes("populate")) {
      return ctx.throw(500, "Database query error: " + error.message);
    }
    
    return ctx.throw(500, "Internal server error while fetching demo bookings");
  }
}
  })
);

// Helper function to check tutor availability
async function checkTutorAvailability(tutorId, bookingDate) {
  const dayOfWeek = bookingDate.toLocaleDateString("en-US", {
    weekday: "long",
  });

  // Get tutor's availability for the specific day
  const tutorAvailability = await strapi.entityService.findMany(
    "api::mentor-availability.mentor-availability",
    {
      filters: {
        mentor: tutorId,
        "days.day": dayOfWeek,
        "days.is_available": true,
      },
      populate: ["days"],
    }
  );

  if (tutorAvailability.length === 0) {
    return false;
  }

  // Check if the requested time falls within any available slot
  const bookingTime = bookingDate.toTimeString().slice(0, 5);

  for (const availability of tutorAvailability) {
    for (const day of availability.days) {
      if (day.day === dayOfWeek && day.is_available) {
        if (bookingTime >= day.start_time && bookingTime <= day.end_time) {
          return true;
        }
      }
    }
  }

  return false;
}

// Helper function to get tutor's day availability
async function getTutorDayAvailability(tutorId, dayOfWeek) {
  const availability = await strapi.entityService.findMany(
    "api::mentor-availability.mentor-availability",
    {
      filters: {
        mentor: tutorId,
        "days.day": dayOfWeek,
        "days.is_available": true,
      },
      populate: ["days"],
    }
  );

  return availability.flatMap((avail) =>
    avail.days.filter((day) => day.day === dayOfWeek)
  );
}

// Helper function to calculate available slots
async function calculateAvailableSlots(availability, existingBookings, date) {
  const availableSlots = [];

  for (const slot of availability) {
    const startTime = new Date(`1970-01-01T${slot.start_time}`);
    const endTime = new Date(`1970-01-01T${slot.end_time}`);

    // Generate 30-minute slots
    for (
      let time = new Date(startTime);
      time < endTime;
      time.setMinutes(time.getMinutes() + 30)
    ) {
      const slotTime = time.toTimeString().slice(0, 5);
      const slotDateTime = new Date(`${date}T${slotTime}`);

      // Check if slot is already booked
      const isBooked = existingBookings.some((booking) => {
        const bookingTime = new Date(booking.booking_date);
        return (
          bookingTime.getHours() === time.getHours() &&
          bookingTime.getMinutes() === time.getMinutes()
        );
      });

      if (!isBooked && slotDateTime > new Date()) {
        availableSlots.push(slotTime);
      }
    }
  }

  return availableSlots;
}

// Helper function to send demo booking emails
async function sendDemoBookingEmails(demoBooking) {
  try {
    const { student, tutor } = demoBooking;

    // Send email to student
    // await strapi.plugins["email"].services.email.send({
    //   to: student.email,
    //   from: "tychr@saralgroups.com",
    //   subject: "Demo Session Confirmation - TyChr",
    //   html: `
    //     <!DOCTYPE html>
    //     <html>
    //     <head>
    //       <style>
    //         body { font-family: Arial, sans-serif; line-height: 1.6; }
    //         .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    //         .header { background: #2c3e50; color: white; padding: 20px; text-align: center; }
    //         .content { padding: 20px; background: #f9f9f9; }
    //       </style>
    //     </head>
    //     <body>
    //       <div class="container">
    //         <div class="header">
    //           <h1>Demo Session Booked!</h1>
    //         </div>
    //         <div class="content">
    //           <p>Hello ${student.fullName},</p>
    //           <p>Your demo session has been successfully booked with ${
    //             tutor.fullName
    //           }.</p>
    //           <p><strong>Details:</strong></p>
    //           <ul>
    //             <li>Date & Time: ${new Date(
    //               demoBooking.booking_date
    //             ).toLocaleString()}</li>
    //             <li>Duration: ${demoBooking.duration} minutes</li>
    //             <li>Tutor: ${tutor.fullName}</li>
    //           </ul>
    //           <p>You will receive a meeting link before the session.</p>
    //           <p>Thank you for choosing TyChr!</p>
    //         </div>
    //       </div>
    //     </body>
    //     </html>
    //   `,
    // });

    // Send email to tutor
    // await strapi.plugins["email"].services.email.send({
    //   to: tutor.email,
    //   from: "tychr@saralgroups.com",
    //   subject: "New Demo Session Booking - TyChr",
    //   html: `
    //     <!DOCTYPE html>
    //     <html>
    //     <head>
    //       <style>
    //         body { font-family: Arial, sans-serif; line-height: 1.6; }
    //         .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    //         .header { background: #2c3e50; color: white; padding: 20px; text-align: center; }
    //         .content { padding: 20px; background: #f9f9f9; }
    //       </style>
    //     </head>
    //     <body>
    //       <div class="container">
    //         <div class="header">
    //           <h1>New Demo Session</h1>
    //         </div>
    //         <div class="content">
    //           <p>Hello ${tutor.fullName},</p>
    //           <p>You have a new demo session booking from ${
    //             student.fullName
    //           }.</p>
    //           <p><strong>Details:</strong></p>
    //           <ul>
    //             <li>Date & Time: ${new Date(
    //               demoBooking.booking_date
    //             ).toLocaleString()}</li>
    //             <li>Duration: ${demoBooking.duration} minutes</li>
    //             <li>Student: ${student.fullName}</li>
    //             <li>Student Email: ${student.email}</li>
    //           </ul>
    //         </div>
    //       </div>
    //     </body>
    //     </html>
    //   `,
    // });
  } catch (error) {
    console.error("Error sending demo booking emails:", error);
  }
}

// Helper function to send status update emails
async function sendStatusUpdateEmail(demoBooking) {
  try {
    const { student, tutor, status } = demoBooking;

    const emailSubject =
      {
        Confirmed: "Demo Session Confirmed",
        Cancelled: "Demo Session Cancelled",
        Completed: "Demo Session Completed",
        "No-show": "Demo Session Marked as No-show",
      }[status] || "Demo Session Status Updated";

    await strapi.plugins["email"].services.email.send({
      to: student.email,
      from: "tychr@saralgroups.com",
      subject: `${emailSubject} - TyChr`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2c3e50; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9f9f9; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${emailSubject}</h1>
            </div>
            <div class="content">
              <p>Hello ${student.fullName},</p>
              <p>Your demo session with ${
                tutor.fullName
              } has been ${status.toLowerCase()}.</p>
              <p><strong>Details:</strong></p>
              <ul>
                <li>Date & Time: ${new Date(
                  demoBooking.booking_date
                ).toLocaleString()}</li>
                <li>Status: ${status}</li>
                ${
                  demoBooking.meeting_link
                    ? `<li>Meeting Link: <a href="${demoBooking.meeting_link}">Join Meeting</a></li>`
                    : ""
                }
              </ul>
            </div>
          </div>
        </body>
        </html>
      `,
    });
  } catch (error) {
    console.error("Error sending status update email:", error);
  }
}

// Helper function to update notification status
async function updateNotificationStatus(studentId, newStatus, demoBooking) {
  try {
    // Find the latest notification for this student
    const notifications = await strapi.entityService.findMany(
      "api::notification.notification",
      {
        filters: { user: studentId },
        sort: { createdAt: "desc" },
        limit: 1,
        populate: ["user", "conversion_history"],
      }
    );

    if (notifications.length > 0) {
      const notification = notifications[0];
      const previousStatus = notification.tracking_status;

      // Update the notification status
      await strapi.entityService.update(
        "api::notification.notification",
        notification.id,
        {
          data: {
            tracking_status: "Demo Booking", // This will be "Demo Booking"
            // Keep the conversion_history update if needed
            // conversion_history: [
            //   ...(notification.conversion_history || []),
            //   {
            //     previous_status: notification.tracking_status,
            //     new_status: newStatus,
            //     changed_at: new Date().toISOString(),
            //     changed_by: demoBooking.created_by?.id || "system",
            //     demo_booking: demoBooking.id,
            //     notes: `Demo booked with ${
            //       demoBooking.tutor?.fullName || "tutor"
            //     } on ${new Date(demoBooking.booking_date).toLocaleString()}`,
            //   },
            // ],
          },
        }
      );

      console.log(
        `Updated notification ${notification.id} status to ${newStatus}`
      );
    } else {
      console.warn(`No notification found for student ${studentId}`);

      // Create a new notification if none exists
      const student = await strapi.entityService.findOne(
        "plugin::users-permissions.user",
        studentId
      );

      if (student) {
        await strapi.entityService.create("api::notification.notification", {
          data: {
            user: studentId,
            tracking_status: newStatus,
            status: "Pending",
            conversion_history: [
              {
                previous_status: "New Lead",
                new_status: newStatus,
                changed_at: new Date().toISOString(),
                changed_by: demoBooking.created_by?.id || "system",
                demo_booking: demoBooking.id,
                notes: `Demo booked with ${
                  demoBooking.tutor?.fullName || "tutor"
                } on ${new Date(demoBooking.booking_date).toLocaleString()}`,
              },
            ],
            parent_name: student.fullName || "",
            parent_phonenumber: student.phoneNumber || "",
            preferred_classroom_time: "Evening", // Default value
            classroom_limit: "online", // Default value
            classroom_type: "Online", // Default value
            enquiry_type: "Classroom", // Default value
          },
        });

        console.log(`Created new notification for student ${studentId}`);
      }
    }
  } catch (error) {
    console.error("Error updating notification status:", error);
    // Don't throw error here to avoid breaking the demo booking flow
  }
}

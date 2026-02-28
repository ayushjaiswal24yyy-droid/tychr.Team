"use strict";

const { createCoreController } = require("@strapi/strapi").factories;

/**
 * Helper: parse "HH:MM:SS" or "HH:MM" time string into { hours, minutes }
 */
const parseTime = (timeStr) => {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return { hours, minutes };
};

/**
 * Helper: check if a given date+time falls within any of the mentor's available slots
 * for that day of week, and that the entire meeting duration fits within the slot.
 */
const isSlotAvailable = (availability, date, startTimeStr, durationMinutes) => {
  const dayNames = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];

  const meetingDate = new Date(date);
  const dayName = dayNames[meetingDate.getDay()];

  const { hours: startHours, minutes: startMinutes } = parseTime(startTimeStr);
  const meetingStartInMinutes = startHours * 60 + startMinutes;
  const meetingEndInMinutes = meetingStartInMinutes + durationMinutes;

  const dayAvailability = availability.days?.find(
    (d) => d.day === dayName && d.enabled
  );

  if (!dayAvailability) return false;

  return dayAvailability.slots?.some((slot) => {
    const { hours: slotStartH, minutes: slotStartM } = parseTime(slot.start);
    const { hours: slotEndH, minutes: slotEndM } = parseTime(slot.end);

    const slotStartInMinutes = slotStartH * 60 + slotStartM;
    const slotEndInMinutes = slotEndH * 60 + slotEndM;

    // Entire meeting must fit within the slot
    return (
      meetingStartInMinutes >= slotStartInMinutes &&
      meetingEndInMinutes <= slotEndInMinutes
    );
  });
};

/**
 * Helper: check if a mentor already has a meeting that overlaps the requested time
 */
const hasMeetingConflict = async (mentorId, date, startTimeStr, durationMinutes, excludeMeetingId = null) => {
  const { hours: startHours, minutes: startMinutes } = parseTime(startTimeStr);
  const meetingStartInMinutes = startHours * 60 + startMinutes;
  const meetingEndInMinutes = meetingStartInMinutes + durationMinutes;

  const existingMeetings = await strapi.db
    .query("api::student-meeting.student-meeting")
    .findMany({
      where: {
        meeting_with: mentorId,
        date,
        status: { $in: ["scheduled", "in_progress"] },
        ...(excludeMeetingId ? { id: { $ne: excludeMeetingId } } : {}),
      },
      select: ["id", "start_time", "duration_in_minutes"],
    });

  return existingMeetings.some((meeting) => {
    const { hours: mH, minutes: mM } = parseTime(meeting.start_time);
    const existingStart = mH * 60 + mM;
    const existingEnd = existingStart + meeting.duration_in_minutes;

    // Overlap check
    return (
      meetingStartInMinutes < existingEnd &&
      meetingEndInMinutes > existingStart
    );
  });
};

module.exports = createCoreController(
  "api::student-meeting.student-meeting",
  ({ strapi }) => ({
    /**
     * GET /student-meetings/my-plans
     * Returns all active user_plans for the logged-in student with remaining hours
     */
 async myPlans(ctx) {
  try {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized("Unauthorized");

    const plans = await strapi.db
      .query("api::user-plan.user-plan")
      .findMany({
        where: { student: user.id, status: "active" },
        populate: {
          premium_plan: {
            populate: {
              created_by_user: {
                populate: { avatar: true },
              },
            },
          },
        },
        orderBy: { purchased_at: "desc" },
      });

    return {
      success: true,
      data: plans.map((plan) => ({
        id: plan.id,
        remaining_hours: plan.remaining_hours,
        status: plan.status,
        purchased_at: plan.purchased_at,
        total_paid: plan.total_paid,
        currency: plan.currency,
        premium_plan: plan.premium_plan ? {
          id: plan.premium_plan.id,
          title: plan.premium_plan.title,
          type: plan.premium_plan.type,
          hours_included: plan.premium_plan.hours_included,
          price: plan.premium_plan.price,
          currency: plan.premium_plan.currency,
          created_by_user: plan.premium_plan.created_by_user ? {
            id: plan.premium_plan.created_by_user.id,
            fullName: plan.premium_plan.created_by_user.fullName,
            username: plan.premium_plan.created_by_user.username,
            graduated_from: plan.premium_plan.created_by_user.graduated_from,
            highest_educational_qualification:
              plan.premium_plan.created_by_user.highest_educational_qualification,
            avatar: plan.premium_plan.created_by_user.avatar
              ? { url: plan.premium_plan.created_by_user.avatar.url }
              : null,
          } : null,
        } : null,
      })),
    };
  } catch (err) {
    strapi.log.error("myPlans error:", err);
    return ctx.internalServerError("Failed to fetch plans");
  }
},

    /**
     * GET /student-meetings/my-meetings
     * Returns meeting history for the logged-in student
     * Optional query params: ?status=scheduled&page=1&pageSize=10
     */
    async myMeetings(ctx) {
      try {
        const user = ctx.state.user;
        if (!user) return ctx.unauthorized("Unauthorized");

        const { status, page = 1, pageSize = 10 } = ctx.query;

        const where = { student: user.id };
        if (status) where.status = status;

        const [meetings, total] = await Promise.all([
          strapi.db.query("api::student-meeting.student-meeting").findMany({
            where,
            populate: {
              meeting_with: {
                select: ["id", "username", "email", "firstName", "lastName"],
              },
              user_plan: {
                populate: {
                  premium_plan: { select: ["id", "title", "type"] },
                },
              },
            },
            orderBy: [{ date: "desc" }, { start_time: "desc" }],
            limit: Number(pageSize),
            offset: (Number(page) - 1) * Number(pageSize),
          }),
          strapi.db.query("api::student-meeting.student-meeting").count({ where }),
        ]);

        return {
          success: true,
          data: meetings,
          pagination: {
            page: Number(page),
            pageSize: Number(pageSize),
            total,
            pageCount: Math.ceil(total / Number(pageSize)),
          },
        };
      } catch (err) {
        strapi.log.error("myMeetings error:", err);
        return ctx.internalServerError("Failed to fetch meetings");
      }
    },

    /**
     * POST /student-meetings/schedule
     * Body: {
     *   user_plan_id,
     *   mentor_id,
     *   date,           // "YYYY-MM-DD"
     *   start_time,     // "HH:MM"
     *   duration_in_minutes,
     *   title,
     *   description,    // optional
     *   link,
     * }
     */
    async schedule(ctx) {
      try {
        const user = ctx.state.user;
        if (!user) return ctx.unauthorized("Unauthorized");

        const {
          user_plan_id,
          mentor_id,
          date,
          start_time,
          duration_in_minutes,
          title,
          description,
          link,
        } = ctx.request.body;

        // ── Basic validation ──────────────────────────────────────────────
        if (
          !user_plan_id ||
          !mentor_id ||
          !date ||
          !start_time ||
          !duration_in_minutes ||
          !title ||
          !link
        ) {
          return ctx.badRequest("Missing required fields");
        }

        if (duration_in_minutes < 15 || duration_in_minutes > 120) {
          return ctx.badRequest("Duration must be between 15 and 120 minutes");
        }

        // ── 1. Validate user_plan belongs to student and is active ────────
        const userPlan = await strapi.entityService.findOne(
          "api::user-plan.user-plan",
          user_plan_id,
          { populate: ["premium_plan", "student"] }
        );

        if (!userPlan || userPlan.student?.id !== user.id) {
          return ctx.badRequest("Invalid plan");
        }

        if (userPlan.status !== "active") {
          return ctx.badRequest("This plan is no longer active");
        }

        // ── 2. Check student has enough remaining hours ───────────────────
        const durationInHours = duration_in_minutes / 60;
        if (Number(userPlan.remaining_hours) < durationInHours) {
          return ctx.badRequest(
            `Insufficient hours. You have ${userPlan.remaining_hours}h remaining but need ${durationInHours.toFixed(2)}h`
          );
        }

        // ── 3. Validate mentor exists and plan type matches mentor type ────
        const mentor = await strapi.db
          .query("plugin::users-permissions.user")
          .findOne({
            where: { id: mentor_id },
            select: ["id", "username", "role"],
          });

        if (!mentor) {
          return ctx.badRequest("Mentor not found");
        }

        // ── 4. Validate slot against mentor_availability ──────────────────
        const availability = await strapi.db
          .query("api::mentor-availability.mentor-availability")
          .findOne({
            where: {
              mentor: mentor_id,
              publishedAt: { $ne: null }, // only published availability
            },
            populate: { days: { populate: ["slots"] } },
          });

        if (!availability) {
          return ctx.badRequest("Mentor has no availability set up");
        }

        const slotValid = isSlotAvailable(
          availability,
          date,
          start_time,
          duration_in_minutes
        );

        if (!slotValid) {
          return ctx.badRequest(
            "Selected time is outside mentor's available slots"
          );
        }

        // ── 5. Check mentor has no conflicting meetings ───────────────────
        const conflict = await hasMeetingConflict(
          mentor_id,
          date,
          start_time,
          duration_in_minutes
        );

        if (conflict) {
          return ctx.badRequest(
            "Mentor already has a meeting scheduled at this time"
          );
        }

        // ── 6. Create the meeting ─────────────────────────────────────────
        const meeting = await strapi.entityService.create(
          "api::student-meeting.student-meeting",
          {
            data: {
              title,
              description: description || null,
              link,
              date,
              start_time,
              duration_in_minutes,
              student: user.id,
              meeting_with: mentor_id,
              user_plan: user_plan_id,
              status: "scheduled",
            },
          }
        );

        return {
          success: true,
          message: "Meeting scheduled successfully",
          data: {
            id: meeting.id,
            title: meeting.title,
            date: meeting.date,
            start_time: meeting.start_time,
            duration_in_minutes: meeting.duration_in_minutes,
            status: meeting.status,
            link: meeting.link,
          },
        };
      } catch (err) {
        strapi.log.error("schedule meeting error:", err);
        return ctx.internalServerError("Failed to schedule meeting");
      }
    },

    /**
     * POST /student-meetings/:id/complete
     * Mentor marks meeting as completed → triggers lifecycle hook (hours deduction + transaction_out)
     */
    async complete(ctx) {
      try {
        const user = ctx.state.user;
        if (!user) return ctx.unauthorized("Unauthorized");

        const { id } = ctx.params;

        const meeting = await strapi.entityService.findOne(
          "api::student-meeting.student-meeting",
          id,
          { populate: ["meeting_with", "student"] }
        );

        if (!meeting) return ctx.notFound("Meeting not found");

        // Only the assigned mentor can mark complete
        if (meeting.meeting_with?.id !== user.id) {
          return ctx.forbidden("Only the assigned mentor can complete this meeting");
        }

        if (meeting.status === "completed") {
          return ctx.badRequest("Meeting is already completed");
        }

        if (!["scheduled", "in_progress", "interrupted"].includes(meeting.status)) {
          return ctx.badRequest(
            `Cannot complete a meeting with status: ${meeting.status}`
          );
        }

        const updated = await strapi.entityService.update(
          "api::student-meeting.student-meeting",
          id,
          { data: { status: "completed" } }
        );

        return {
          success: true,
          message: "Meeting marked as completed",
          data: { id: updated.id, status: updated.status },
        };
      } catch (err) {
        strapi.log.error("complete meeting error:", err);
        return ctx.internalServerError("Failed to complete meeting");
      }
    },

    /**
     * POST /student-meetings/:id/interrupt
     * Mentor marks meeting as interrupted → no hours deducted, student can raise support ticket
     */
    async interrupt(ctx) {
      try {
        const user = ctx.state.user;
        if (!user) return ctx.unauthorized("Unauthorized");

        const { id } = ctx.params;
        const { notes } = ctx.request.body; // optional reason

        const meeting = await strapi.entityService.findOne(
          "api::student-meeting.student-meeting",
          id,
          { populate: ["meeting_with"] }
        );

        if (!meeting) return ctx.notFound("Meeting not found");

        // Only the assigned mentor can mark interrupted
        if (meeting.meeting_with?.id !== user.id) {
          return ctx.forbidden(
            "Only the assigned mentor can mark this meeting as interrupted"
          );
        }

        if (!["scheduled", "in_progress", "completed"].includes(meeting.status)) {
          return ctx.badRequest(
            `Cannot interrupt a meeting with status: ${meeting.status}`
          );
        }

        const updated = await strapi.entityService.update(
          "api::student-meeting.student-meeting",
          id,
          {
            data: {
              status: "interrupted",
              meeting_notes: notes
                ? `[INTERRUPTED] ${notes}`
                : "[INTERRUPTED] Marked as interrupted by mentor",
            },
          }
        );

        return {
          success: true,
          message:
            "Meeting marked as interrupted. No hours have been deducted. Student can raise a support ticket.",
          data: { id: updated.id, status: updated.status },
        };
      } catch (err) {
        strapi.log.error("interrupt meeting error:", err);
        return ctx.internalServerError("Failed to interrupt meeting");
      }
    },
  })
);
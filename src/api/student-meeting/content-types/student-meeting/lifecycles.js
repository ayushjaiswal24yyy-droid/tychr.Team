"use strict";

// src/api/student-meeting/content-types/student-meeting/lifecycles.js

module.exports = {
  async afterUpdate(event) {
    const { result } = event;

    // Only trigger on completed — skip interrupted, canceled, no_show
    if (result.status !== "completed") return;

    // Fetch full meeting with relations
    const meeting = await strapi.entityService.findOne(
      "api::student-meeting.student-meeting",
      result.id,
      {
        populate: ["user_plan", "meeting_with", "admin_transaction_out"],
      }
    );

    if (!meeting?.user_plan) {
      strapi.log.warn(
        `Meeting ${result.id} completed but has no linked user_plan`
      );
      return;
    }

    // Guard: don't process if transaction_out already exists (idempotency)
    if (meeting.admin_transaction_out) {
      strapi.log.warn(
        `Meeting ${result.id} already has a transaction_out — skipping duplicate processing`
      );
      return;
    }

    const userPlan = await strapi.entityService.findOne(
      "api::user-plan.user-plan",
      meeting.user_plan.id,
      { populate: ["premium_plan"] }
    );

    if (!userPlan) {
      strapi.log.warn(`user_plan ${meeting.user_plan.id} not found`);
      return;
    }

    const durationInMinutes = meeting.duration_in_minutes;
    const hoursUsed = durationInMinutes / 60;
    const newRemainingHours = Number(
      (Number(userPlan.remaining_hours) - hoursUsed).toFixed(4)
    );
    const newStatus = newRemainingHours <= 0 ? "used_up" : "active";

    // 1️⃣ Deduct hours from user_plan
    await strapi.entityService.update(
      "api::user-plan.user-plan",
      userPlan.id,
      {
        data: {
          remaining_hours: Math.max(newRemainingHours, 0),
          status: newStatus,
        },
      }
    );

    // 2️⃣ Calculate payout amount based on rate per hour at time of purchase
    const hoursIncluded = userPlan.premium_plan?.hours_included;
    const ratePerHour =
      hoursIncluded && hoursIncluded > 0
        ? Number(userPlan.price_at_purchase) / hoursIncluded
        : 0;

    const amount = Number((ratePerHour * hoursUsed).toFixed(2));

    // 3️⃣ Create transaction_out for admin payout queue
    await strapi.entityService.create("api::transaction-out.transaction-out", {
      data: {
        student_meeting: meeting.id,
        meeting_scheduled_with: meeting.meeting_with?.id ?? null,
        user_plan: userPlan.id,
        transaction_date: new Date(),
        duration_minutes: durationInMinutes,
        amount,
        currency: userPlan.currency,
        payment_status: "pending",
        notes: `Auto-generated on meeting completion. Meeting ID: ${meeting.id}`,
      },
    });

    strapi.log.info(
      `Meeting ${meeting.id} completed — deducted ${hoursUsed}h from user_plan ${userPlan.id}. ` +
      `Remaining: ${Math.max(newRemainingHours, 0)}h. Status: ${newStatus}. Transaction out created.`
    );
  },
};
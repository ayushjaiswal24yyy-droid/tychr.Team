"use strict";

const Razorpay = require("razorpay");
const crypto = require("crypto");

/**
 * Helpers
 */

const SUBJECT_LIMIT_MAP = {
  limit_1: 1,
  limit_3: 3,
  limit_6: 6,
};

const DURATION_MAP = {
  months_3: 3,
  months_6: 6,
  months_12: 12,
};

const getRazorpayInstanceForUser = async (userId) => {
  const user = await strapi.db
    .query("plugin::users-permissions.user")
    .findOne({
      where: { id: userId },
      select: ["id", "is_test_user"],
    });

  const isTestUser = user?.is_test_user === true;

  return {
    isTestUser,
    razorpay: new Razorpay({
      key_id: isTestUser
        ? process.env.RAZORPAY_TEST_KEY_ID
        : process.env.RAZORPAY_LIVE_KEY_ID,
      key_secret: isTestUser
        ? process.env.RAZORPAY_TEST_SECRET_ID
        : process.env.RAZORPAY_LIVE_SECRET_ID,
    }),
  };
};



module.exports = {
  /**
   * STEP 1: Create Razorpay Order
   * POST /user-content-plans/create-order
   */
  async createOrder(ctx) {
    try {
      const { content_plan_id } = ctx.request.body;

      if (!content_plan_id) {
        return ctx.badRequest("content_plan_id is required");
      }

const user = ctx.state.user;

      if (!user) return ctx.unauthorized("Unauthorized");

      const contentPlan = await strapi.entityService.findOne(
        "api::content-plan.content-plan",
        content_plan_id
      );

      if (!contentPlan || !contentPlan.active) {
        return ctx.badRequest("Invalid or inactive content plan");
      }

      const { razorpay, isTestUser } =
        await getRazorpayInstanceForUser(user.id);

      const amountInPaise = Math.round(Number(contentPlan.price) * 100);

      const order = await razorpay.orders.create({
        amount: amountInPaise,
        currency: contentPlan.currency,
        receipt: `plan_${contentPlan.id}_${Date.now()}`,
        payment_capture: 1,
        notes: {
          user_id: user.id,
          content_plan_id: contentPlan.id,
          type: "content_plan_purchase",
        },
      });

      return {
        success: true,
        razorpay_order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        razorpay_key: isTestUser
          ? process.env.RAZORPAY_TEST_KEY_ID
          : process.env.RAZORPAY_LIVE_KEY_ID,
      };
    } catch (err) {
      strapi.log.error("Create order error", err);
      return ctx.internalServerError("Failed to create order");
    }
  },

  /**
   * STEP 2: Verify Payment & Create Purchase
   * POST /user-content-plans/verify-payment
   */
  async verifyPayment(ctx) {
    try {
      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        content_plan_id,
      } = ctx.request.body;

      if (
        !razorpay_order_id ||
        !razorpay_payment_id ||
        !razorpay_signature ||
        !content_plan_id
      ) {
        return ctx.badRequest("Missing required fields");
      }

      const user = ctx.state.user;
      if (!user) return ctx.unauthorized("Unauthorized");

      const contentPlan = await strapi.entityService.findOne(
        "api::content-plan.content-plan",
        content_plan_id
      );

      if (!contentPlan || !contentPlan.active) {
        return ctx.badRequest("Invalid content plan");
      }

      const isTestUser = user.is_test_user === true;

      const secret = isTestUser
        ? process.env.RAZORPAY_TEST_SECRET_ID
        : process.env.RAZORPAY_LIVE_SECRET_ID;

      // Verify signature
      const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest("hex");

      if (expectedSignature !== razorpay_signature) {
        return ctx.badRequest("Invalid payment signature");
      }

      // Prevent duplicate purchase records
      const existingPurchase = await strapi.db
        .query("api::user-content-plan.user-content-plan")
        .findOne({
          where: {
            razorpay_payment_id,
          },
        });

      if (existingPurchase) {
        return {
          success: true,
          message: "Payment already processed",
          data: existingPurchase,
        };
      }

      // Calculate expiry
      const durationMonths =
        DURATION_MAP[contentPlan.duration_months];

      const expires_at = new Date();
      expires_at.setMonth(expires_at.getMonth() + durationMonths);

      const remaining_subjects =
        SUBJECT_LIMIT_MAP[contentPlan.subject_limit];

      const purchase = await strapi.entityService.create(
        "api::user-content-plan.user-content-plan",
        {
          data: {
            student: user.id,
            content_plan: contentPlan.id,
            purchased_at: new Date(),
            expires_at,
            remaining_subjects,
            total_paid: contentPlan.price,
            currency: contentPlan.currency,
            status: "active",
            razorpay_payment_id,
          },
        }
      );

      return {
        success: true,
        message: "Content plan purchased successfully",
        data: {
          id: purchase.id,
          expires_at,
          remaining_subjects,
        },
      };
    } catch (err) {
      strapi.log.error("Verify payment error", err);
      return ctx.internalServerError("Payment verification failed");
    }
  },
};

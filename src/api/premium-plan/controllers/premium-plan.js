// src/api/premium-plan/controllers/premium-plan.js

"use strict";

const { createCoreController } = require("@strapi/strapi").factories;
const Razorpay = require("razorpay");
const crypto = require("crypto");

/**
 * Helper: get correct Razorpay instance based on test/live user
 */
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

module.exports = createCoreController(
  "api::premium-plan.premium-plan",
  ({ strapi }) => ({
    /**
     * STEP 1: Create Razorpay Order
     * POST /premium-plans/create-order
     * Body: { premium_plan_id }
     */
    async createOrder(ctx) {
      try {
        const { premium_plan_id } = ctx.request.body;

        if (!premium_plan_id) {
          return ctx.badRequest("premium_plan_id is required");
        }

        const user = ctx.state.user;
        if (!user) return ctx.unauthorized("Unauthorized");

        const premiumPlan = await strapi.entityService.findOne(
          "api::premium-plan.premium-plan",
          premium_plan_id
        );

        if (!premiumPlan || !premiumPlan.active) {
          return ctx.badRequest("Invalid or inactive premium plan");
        }

        if (!premiumPlan.currency) {
          return ctx.badRequest("Plan has no currency configured");
        }

        if (!premiumPlan.hours_included || premiumPlan.hours_included <= 0) {
          return ctx.badRequest("Plan has no hours configured");
        }

        const { razorpay, isTestUser } = await getRazorpayInstanceForUser(
          user.id
        );

        const order = await razorpay.orders.create({
          amount: Math.round(Number(premiumPlan.price) * 100), // paise/cents
          currency: premiumPlan.currency,
          receipt: `pplan_${premiumPlan.id}_${Date.now()}`,
          payment_capture: 1,
          notes: {
            user_id: String(user.id),
            premium_plan_id: String(premiumPlan.id),
            type: "premium_plan_purchase",
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
        strapi.log.error("Premium plan create order error:", err);
        return ctx.internalServerError("Failed to create order");
      }
    },

    /**
     * STEP 2: Verify Payment & Create/Update UserPlan
     * POST /premium-plans/verify-payment
     * Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature, premium_plan_id }
     */
    async verifyPayment(ctx) {
      const trx = await strapi.db.connection.transaction();

      try {
        const {
          razorpay_order_id,
          razorpay_payment_id,
          razorpay_signature,
          premium_plan_id,
        } = ctx.request.body;

        if (
          !razorpay_order_id ||
          !razorpay_payment_id ||
          !razorpay_signature ||
          !premium_plan_id
        ) {
          await trx.rollback();
          return ctx.badRequest("Missing required fields");
        }

        const user = ctx.state.user;
        if (!user) {
          await trx.rollback();
          return ctx.unauthorized("Unauthorized");
        }

        const premiumPlan = await strapi.entityService.findOne(
          "api::premium-plan.premium-plan",
          premium_plan_id
        );

        if (!premiumPlan || !premiumPlan.active) {
          await trx.rollback();
          return ctx.badRequest("Invalid or inactive premium plan");
        }

        /**
         * 1️⃣ VERIFY SIGNATURE
         */
        const isTestUser = user.is_test_user === true;
        const secret = isTestUser
          ? process.env.RAZORPAY_TEST_SECRET_ID
          : process.env.RAZORPAY_LIVE_SECRET_ID;

        const expectedSignature = crypto
          .createHmac("sha256", secret)
          .update(`${razorpay_order_id}|${razorpay_payment_id}`)
          .digest("hex");

        if (expectedSignature !== razorpay_signature) {
          await trx.rollback();
          return ctx.badRequest("Invalid payment signature");
        }

        /**
         * 2️⃣ PREVENT DUPLICATE PROCESSING
         */
        const existingPurchase = await strapi.db
          .query("api::user-plan.user-plan")
          .findOne({
            where: { razorpay_payment_id },
            transacting: trx,
          });

        if (existingPurchase) {
          await trx.rollback();
          return {
            success: true,
            message: "Payment already processed",
            data: { id: existingPurchase.id },
          };
        }

        /**
         * 3️⃣ VALIDATE ORDER AGAINST RAZORPAY
         */
        const { razorpay } = await getRazorpayInstanceForUser(user.id);
        const order = await razorpay.orders.fetch(razorpay_order_id);

        if (
          String(order.notes.premium_plan_id) !== String(premium_plan_id) ||
          String(order.notes.user_id) !== String(user.id)
        ) {
          await trx.rollback();
          return ctx.badRequest("Order validation failed");
        }

        const paidAmount = Number(order.amount) / 100;

        /**
         * 4️⃣ CHECK IF STUDENT ALREADY HAS AN ACTIVE PLAN FOR THIS PREMIUM PLAN
         *    If yes → stack hours on it
         *    If no  → create a new user_plan
         */
        const existingActivePlan = await strapi.db
          .query("api::user-plan.user-plan")
          .findOne({
            where: {
              student: user.id,
              premium_plan: premiumPlan.id,
              status: "active",
            },
            transacting: trx,
          });

        let resultPlan;

        if (existingActivePlan) {
          /**
           * STACK HOURS onto existing active plan
           */
          const newRemainingHours = Number(
            (
              Number(existingActivePlan.remaining_hours) +
              Number(premiumPlan.hours_included)
            ).toFixed(4)
          );

          resultPlan = await strapi.entityService.update(
            "api::user-plan.user-plan",
            existingActivePlan.id,
            {
              data: {
                remaining_hours: newRemainingHours,
                // Log latest payment ids for audit — last purchase wins
                razorpay_payment_id,
                razorpay_order_id,
              },
              transacting: trx,
            }
          );

          await trx.commit();

          return {
            success: true,
            message: "Hours added to existing plan",
            data: {
              id: resultPlan.id,
              remaining_hours: newRemainingHours,
              total_paid: paidAmount,
              stacked: true,
            },
          };
        } else {
          /**
           * CREATE NEW USER PLAN
           */
          resultPlan = await strapi.entityService.create(
            "api::user-plan.user-plan",
            {
              data: {
                student: user.id,
                premium_plan: premiumPlan.id,
                purchased_at: new Date(),
                remaining_hours: Number(premiumPlan.hours_included),
                status: "active",
                price_at_purchase: Number(premiumPlan.price),
                total_paid: paidAmount,
                currency: premiumPlan.currency,
                razorpay_payment_id,
                razorpay_order_id,
              },
              transacting: trx,
            }
          );

          await trx.commit();

          return {
            success: true,
            message: "Premium plan purchased successfully",
            data: {
              id: resultPlan.id,
              remaining_hours: Number(premiumPlan.hours_included),
              total_paid: paidAmount,
              currency: premiumPlan.currency,
              status: "active",
              stacked: false,
            },
          };
        }
      } catch (err) {
        await trx.rollback();
        strapi.log.error("Premium plan verify payment error:", err);
        return ctx.internalServerError("Payment verification failed");
      }
    },
  })
);
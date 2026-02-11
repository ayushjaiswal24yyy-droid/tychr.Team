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

      // 🔎 Find active plan
      const activePlan = await strapi.db
        .query("api::user-content-plan.user-content-plan")
        .findOne({
          where: {
            student: user.id,
            status: "active",
            expires_at: { $gt: new Date() },
          },
          populate: ["content_plan"],

        });

      let finalAmount = Number(contentPlan.price);
      let creditedAmount = 0;

      // 💡 Upgrade logic
      if (activePlan) {
        const oldPlan = activePlan.content_plan;

        if (oldPlan.currency !== contentPlan.currency) {
          return ctx.badRequest("Currency mismatch. Cannot upgrade.");
        }

        if (Number(contentPlan.price) <= Number(oldPlan.price)) {
          return ctx.badRequest("Cannot downgrade or repurchase same tier.");
        }


        const now = new Date();
        const totalDuration =
          DURATION_MAP[oldPlan.duration_months] * 30 * 24 * 60 * 60 * 1000;

        const remainingTime =
          new Date(activePlan.expires_at).getTime() - now.getTime();

        const remainingRatio = Math.max(remainingTime / totalDuration, 0);

        creditedAmount =
          Number(oldPlan.price) * remainingRatio;

        finalAmount = Math.max(
          Number(contentPlan.price) - creditedAmount,
          0
        );
      }

      const { razorpay, isTestUser } =
        await getRazorpayInstanceForUser(user.id);

      const order = await razorpay.orders.create({
        amount: Math.round(finalAmount * 100),
        currency: contentPlan.currency,
        receipt: `plan_${contentPlan.id}_${Date.now()}`,
        payment_capture: 1,
        notes: {
          user_id: user.id,
          content_plan_id: contentPlan.id,
          credited_amount: creditedAmount,
          type: "content_plan_upgrade",
        },
      });

      return {
        success: true,
        razorpay_order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        credited_amount: creditedAmount,
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
    const trx = await strapi.db.connection.transaction();

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
        await trx.rollback();
        return ctx.badRequest("Missing required fields");
      }

      const user = ctx.state.user;
      if (!user) {
        await trx.rollback();
        return ctx.unauthorized("Unauthorized");
      }

      const contentPlan = await strapi.entityService.findOne(
        "api::content-plan.content-plan",
        content_plan_id
      );

      if (!contentPlan || !contentPlan.active) {
        await trx.rollback();
        return ctx.badRequest("Invalid or inactive content plan");
      }

      const isTestUser = user.is_test_user === true;

      const secret = isTestUser
        ? process.env.RAZORPAY_TEST_SECRET_ID
        : process.env.RAZORPAY_LIVE_SECRET_ID;

      /**
       * 1️⃣ VERIFY SIGNATURE FIRST
       */
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
        .query("api::user-content-plan.user-content-plan")
        .findOne({
          where: { razorpay_payment_id },
          transacting: trx,
        });


      if (existingPurchase) {
        await trx.rollback();
        return {
          success: true,
          message: "Payment already processed",
          data: existingPurchase,
        };
      }

      /**
       * 3️⃣ FETCH RAZORPAY ORDER TO READ CREDIT
       */
      const { razorpay } = await getRazorpayInstanceForUser(user.id);
      const order = await razorpay.orders.fetch(razorpay_order_id);

      const creditedAmount = Number(order.notes?.credited_amount || 0);
      const paidAmount = Number(order.amount) / 100;
      if (
        Number(order.notes.content_plan_id) !== Number(content_plan_id) ||
        Number(order.notes.user_id) !== Number(user.id)
      ) {
        await trx.rollback();
        return ctx.badRequest("Order validation failed");
      }

      /**
       * 4️⃣ FIND ACTIVE PLAN (IF ANY)
       */
      const activePlan = await strapi.db
        .query("api::user-content-plan.user-content-plan")
        .findOne({
          where: {
            student: user.id,
            status: "active",
            expires_at: { $gt: new Date() },
          },
          populate: ["content_plan"],
          transacting: trx,
        });

      let upgradeFromId = null;

      if (activePlan) {
        const oldPlan = activePlan.content_plan;

        // 🔒 Downgrade protection
        if (Number(contentPlan.price) <= Number(oldPlan.price)) {
          await trx.rollback();
          return ctx.badRequest("Cannot downgrade or repurchase same tier.");
        }

        upgradeFromId = activePlan.id;

        // Expire old plan
        await strapi.entityService.update(
          "api::user-content-plan.user-content-plan",
          activePlan.id,
          {
            data: { status: "expired" },
            transacting: trx,
          }
        );
      }

      /**
       * 5️⃣ CALCULATE NEW EXPIRY
       */
      const durationMonths = DURATION_MAP[contentPlan.duration_months];
      const expires_at = new Date();
      expires_at.setMonth(expires_at.getMonth() + durationMonths);

      const remaining_subjects =
        SUBJECT_LIMIT_MAP[contentPlan.subject_limit];

      /**
       * 6️⃣ CREATE NEW PLAN RECORD
       */
      const purchase = await strapi.entityService.create(
        "api::user-content-plan.user-content-plan",
        {
          data: {
            student: user.id,
            content_plan: contentPlan.id,
            purchased_at: new Date(),
            expires_at,
            remaining_subjects,
            total_paid: paidAmount, // actual money collected
            credited_amount: creditedAmount,
            currency: contentPlan.currency,
            status: "active",
            razorpay_payment_id,
            upgrade_from: upgradeFromId,
          },
          transacting: trx,
        }
      );

      await trx.commit();

      return {
        success: true,
        message: "Content plan purchased successfully",
        data: {
          id: purchase.id,
          expires_at,
          remaining_subjects,
          total_paid: paidAmount,
          credited_amount: creditedAmount,
        },
      };
    } catch (err) {
      await trx.rollback();
      strapi.log.error("Verify payment error", err);
      return ctx.internalServerError("Payment verification failed");
    }
  }

};

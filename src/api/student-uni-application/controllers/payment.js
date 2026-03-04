"use strict";

const Razorpay = require("razorpay");
const crypto = require("crypto");

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
   * STEP 1: Create Razorpay order for application fee
   * POST /student-uni-applications/create-application-fee-order
   *
   * Body: { application_id }
   */
  async createApplicationFeeOrder(ctx) {
    try {
      const { application_id } = ctx.request.body;

      if (!application_id) {
        return ctx.badRequest("application_id is required");
      }

      const user = ctx.state.user;
      if (!user) return ctx.unauthorized("Unauthorized");

      // Fetch application with program populated (for fee) and student
      const application = await strapi.entityService.findOne(
        "api::student-uni-application.student-uni-application",
        application_id,
        { populate: ["student", "program"] }
      );

      if (!application) {
        return ctx.notFound("Application not found");
      }

      // Ownership check
      if (Number(application.student?.id) !== Number(user.id)) {
        return ctx.forbidden("You do not own this application");
      }

      // Already paid
      if (application.application_fee_paid) {
        return ctx.badRequest("Application fee already paid for this application");
      }

      const program = application.program;
      if (!program) {
        return ctx.badRequest("No program linked to this application");
      }

      const feeAmount = Number(program.application_fee);
      if (!feeAmount || feeAmount <= 0) {
        return ctx.badRequest("This program has no application fee configured");
      }

      const { razorpay, isTestUser } = await getRazorpayInstanceForUser(user.id);

      const order = await razorpay.orders.create({
        amount: Math.round(feeAmount * 100), // paise
        currency: "INR",
        receipt: `appfee_${application_id}_${Date.now()}`,
        payment_capture: 1,
        notes: {
          user_id: user.id,
          application_id,
          program_id: program.id,
          type: "application_fee",
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
      strapi.log.error("Create application fee order error", err);
      return ctx.internalServerError("Failed to create application fee order");
    }
  },

  /**
   * STEP 2: Verify payment and unlock application for submission
   * POST /student-uni-applications/verify-application-fee
   *
   * Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature, application_id }
   */
  async verifyApplicationFee(ctx) {
    const trx = await strapi.db.connection.transaction();

    try {
      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        application_id,
      } = ctx.request.body;

      if (
        !razorpay_order_id ||
        !razorpay_payment_id ||
        !razorpay_signature ||
        !application_id
      ) {
        await trx.rollback();
        return ctx.badRequest("Missing required fields");
      }

      const user = ctx.state.user;
      if (!user) {
        await trx.rollback();
        return ctx.unauthorized("Unauthorized");
      }

      // Fetch application
      const application = await strapi.entityService.findOne(
        "api::student-uni-application.student-uni-application",
        application_id,
        { populate: ["student", "program"] }
      );

      if (!application) {
        await trx.rollback();
        return ctx.notFound("Application not found");
      }

      // Ownership check
      if (Number(application.student?.id) !== Number(user.id)) {
        await trx.rollback();
        return ctx.forbidden("You do not own this application");
      }

      // Already paid — idempotent success
      if (application.application_fee_paid) {
        await trx.rollback();
        return {
          success: true,
          message: "Application fee already paid",
        };
      }

      // Duplicate payment record check
      const existingPayment = await strapi.db
        .query("api::payment.payment")
        .findOne({
          where: { razorpay_payment_id },
          transacting: trx,
        });

      if (existingPayment) {
        await trx.rollback();
        return {
          success: true,
          message: "Payment already processed",
          data: existingPayment,
        };
      }

      // Verify signature
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

      // Fetch order from Razorpay to validate notes
      const { razorpay } = await getRazorpayInstanceForUser(user.id);
      const order = await razorpay.orders.fetch(razorpay_order_id);

      if (
        Number(order.notes?.application_id) !== Number(application_id) ||
        Number(order.notes?.user_id) !== Number(user.id) ||
        order.notes?.type !== "application_fee"
      ) {
        await trx.rollback();
        return ctx.badRequest("Order validation failed");
      }

      const paidAmount = Number(order.amount) / 100;

      // Create payment record (reusing existing Payment collection)
      const payment = await strapi.entityService.create(
        "api::payment.payment",
        {
          data: {
            payment_type: "application_fee",
            amount: paidAmount,
            status: "completed",
            razorpay_payment_id,
            razorpay_order_id,
            razorpay_signature,
            student: user.id,
            student_uni_application: application_id,
            metadata: {
              program_id: application.program?.id,
              application_id,
            },
          },
          transacting: trx,
        }
      );

      // Unlock the application for submission
      await strapi.entityService.update(
        "api::student-uni-application.student-uni-application",
        application_id,
        {
          data: {
            application_fee_paid: true,
            application_fee_payment: payment.id,
          },
          transacting: trx,
        }
      );

      await trx.commit();

      return {
        success: true,
        message: "Application fee paid successfully. You can now submit your application.",
        data: {
          payment_id: payment.id,
          amount: paidAmount,
          application_id,
        },
      };
    } catch (err) {
      await trx.rollback();
      strapi.log.error("Verify application fee error", err);
      return ctx.internalServerError("Payment verification failed");
    }
  },

  /**
   * STEP 3: Submit application (fee-gated)
   * POST /student-uni-applications/:id/submit
   */
  async submitApplication(ctx) {
    try {
      const { id } = ctx.params;
      const user = ctx.state.user;
      if (!user) return ctx.unauthorized("Unauthorized");

      const application = await strapi.entityService.findOne(
        "api::student-uni-application.student-uni-application",
        id,
        { populate: ["student", "program"] }
      );

      if (!application) return ctx.notFound("Application not found");

      if (Number(application.student?.id) !== Number(user.id)) {
        return ctx.forbidden("You do not own this application");
      }

      // Fee gate
   const hasFee = application.program?.application_fee != null &&
               Number(application.program.application_fee) > 0;

if (hasFee && !application.application_fee_paid) {
  return ctx.paymentRequired("Application fee must be paid before submitting");
}

      // Already submitted
      if (application.Category === "Submitted") {
        return ctx.badRequest("Application already submitted");
      }

      const updated = await strapi.entityService.update(
        "api::student-uni-application.student-uni-application",
        id,
        { data: { Category: "Submitted" } }
      );

      return {
        success: true,
        message: "Application submitted successfully",
        data: { id: updated.id, Category: updated.Category },
      };
    } catch (err) {
      strapi.log.error("Submit application error", err);
      return ctx.internalServerError("Failed to submit application");
    }
  },
};
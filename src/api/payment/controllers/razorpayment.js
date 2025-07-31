const Razorpay = require("razorpay");
const crypto = require("crypto");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_SECRET_ID,
});

module.exports = {
  async createOrder(ctx) {
    try {
      const { amount } = ctx.request.body;

      if (!amount) {
        return ctx.badRequest("Amount is required");
      }

      const order = await razorpay.orders.create({
        amount: amount * 100, // Convert to paise
        currency: "INR",
      });

      return { order };
    } catch (error) {
      console.error(error);
      return ctx.internalServerError("Payment failed");
    }
  },

  async verifyPayment(ctx) {
    try {
      // Extract required data from request
      const {
        razorpay_order_id,
        razorpay_payment_id,
        planId,
        mentorOrCounsellorId,
      } = ctx.request.body;

      // const expires_at = new Date(
      //   Date.now() + plan_duration_days * 24 * 60 * 60 * 1000
      // ).toISOString();

      //  Create the signature
      // const generatedSignature = crypto
      //   .createHmac("sha256", process.env.RAZORPAY_SECRET_ID)
      //   .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      //   .digest("hex");

      //  Verify signature matches
      // if (generatedSignature !== razorpay_signature) {
      //   return ctx.badRequest("Payment verification failed");
      // }

      const token = ctx.request.header.authorization?.replace("Bearer ", "");
      let userId = null;

      if (token) {
        const { id } = await strapi.plugins[
          "users-permissions"
        ].services.jwt.verify(token);
        userId = id;
      }

      const purchased_at = new Date().toISOString();

      // Log payment details
      console.log(
        "Processing payment verification for order:",
        razorpay_order_id
      );
      console.log({
        userId,
        mentorOrCounsellorId,
        planId,
        razorpay_order_id,
        razorpay_payment_id,
      });

      // Create user plan record
      try {
        const userPlan = await strapi.entityService.create(
          "api::user-plan.user-plan",
          {
            data: {
              razorpay_order_id,
              razorpay_payment_id,
              status: "active",
              purchased_at,
              remaining_hours: 10,
              student: userId,
              premium_plan: planId,
            },
          }
        );

        console.log("Successfully created user plan:", userPlan.id);
        return { verified: true, userPlan, userid: userId };
      } catch (error) {
        console.error("Error creating user plan:", error);
        throw new Error("Failed to create user plan record");
      }
    } catch (error) {
      console.error("Payment verification error:", error);
      return ctx.internalServerError("Payment verification failed");
    }
  },
};

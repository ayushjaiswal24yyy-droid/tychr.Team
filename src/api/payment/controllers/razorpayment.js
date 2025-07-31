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
      const {
        razorpay_order_id,
        razorpay_payment_id,
        // razorpay_signature,
        planId,
        mentorOrCounsellorId,
      } = ctx.request.body;

      const token = ctx.request.header.authorization?.replace("Bearer ", "");
      let userId = null;

      if (token) {
        const { id } = await strapi.plugins[
          "users-permissions"
        ].services.jwt.verify(token);
        userId = id;
      }

      const purchased_at = new Date().toISOString();
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

      console.log("inserting new payment with order ID:", razorpay_order_id);

      console.log(
        "Payment inserted:",
        userId,
        mentorOrCounsellorId,
        planId,
        razorpay_order_id,
        razorpay_payment_id
      );
      try {
        const userPlan = await strapi.entityService.create(
          "api::user-plan.user-plan",
          {
            data: {
              razorpay_order_id,
              razorpay_payment_id,
              // razorpay_signature,
              status: "active",
              purchased_at,
              // expires_at,
              remaining_hours: 10,
              student: userId, // assumes relation by ID
              premium_plan: planId, // assumes relation by ID
            },
          }
        );
        console.log("User plan created:", userPlan);
      } catch (error) {
        console.error("Failed to create user plan:", error);
      }
      return { verified: true };
    } catch (error) {
      console.error(error);
      return ctx.internalServerError("Verification failed");
    }
  },
};

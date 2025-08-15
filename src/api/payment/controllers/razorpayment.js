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
      // if (!token) {
      //   // If no token, try to get userId from session
      //   const session = ctx.state.user;
      //   if (session && session.id) {
      //     userId = session.id;
      //   }
      // }

      if (token) {
        const { id } = await strapi.plugins[
          "users-permissions"
        ].services.jwt.verify(token);
        userId = id;
      }
      if (!userId) {
        return ctx.badRequest("Student (user) not identified");
      }

      const purchased_at = new Date().toISOString();

      // Fetch the premium plan (to get its price and owner info if needed)
      const plan = await strapi.entityService.findOne(
        "api::premium-plan.premium-plan",
        planId,
        {
          populate: [], // expand if you need creator or other relations
        }
      );

      if (!plan) {
        return ctx.badRequest("Invalid premium plan");
      }

      const now = new Date().toISOString();
      let commissionPct = 0; // default to zero if none set

      console.log("plan tye:", plan.type);

      const commissionSettings = await strapi.entityService.findMany(
        "api::commission-setting.commission-setting",
        {
          filters: {
            system_plan: plan?.type === "mentor" ? "mentor" : "counsellor",
            is_premium_plan_active: true,
            premium_plan_effective_from: { $lte: now },
          },
          sort: { premium_plan_effective_from: "desc" },
          limit: 1,
        }
      );
      if (commissionSettings.length > 0) {
        commissionPct =
          parseFloat(commissionSettings[0].premium_plan_percentage) || 0;
      }

      // Compute commission amount (what system admin gets)
      const commissionAmount = (commissionPct / 100) * plan.price;
      const totalPaid = plan.price; // if taxes/fees, add here

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
              remaining_hours: plan.hours_included || 0,
              student: userId,
              premium_plan: planId,
              price_at_purchase: plan.price,
              commission_percentage_applied: commissionPct,
              commission_amount: commissionAmount.toFixed(2),
              total_paid: totalPaid,
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
  async completeTransaction(ctx) {
    try {
      // Extract required data from request
      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        item_id, // ID of the item being purchased (live_lecture, recorded_lecture, or classroom)
        item_type, // 'live_lecture', 'recorded_lecture', or 'classroom'
      } = ctx.request.body;

      // Verify the payment signature (uncomment when ready)
      // const generatedSignature = crypto
      //   .createHmac("sha256", process.env.RAZORPAY_SECRET)
      //   .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      //   .digest("hex");

      // if (generatedSignature !== razorpay_signature) {
      //   return ctx.badRequest("Payment verification failed");
      // }

      // Get user ID from token
      const token = ctx.request.header.authorization?.replace("Bearer ", "");
      if (!token) {
        return ctx.unauthorized("Authorization token missing");
      }

      const { id: userId } = await strapi.plugins[
        "users-permissions"
      ].services.jwt.verify(token);
      if (!userId) {
        return ctx.badRequest("Student (user) not identified");
      }

      // Validate item type
      const validItemTypes = ["live_lecture", "recorded_lecture", "classroom"];
      if (!validItemTypes.includes(item_type)) {
        return ctx.badRequest("Invalid item type");
      }

      let item;
      try {
        const apiName =
          item_type === "classroom"
            ? "enrollment"
            : item_type.replace("_", "-");
        item = await strapi.entityService.findOne(
          `api::${apiName}.${apiName}`,
          item_id,
          {
            populate: ["price", "creator"],
          }
        );
      } catch (error) {
        return ctx.badRequest("Invalid item ID or type");
      }

      if (!item) {
        return ctx.badRequest("Item not found");
      }

      // Get current commission settings for this item type
      const now = new Date().toISOString();
      const commissionSettings = await strapi.entityService.findMany(
        "api::commission-setting.commission-setting",
        {
          filters: {
            system_plan: item_type,
            is_premium_plan_active: true,
            premium_plan_effective_from: { $lte: now },
          },
          sort: { premium_plan_effective_from: "desc" },
          limit: 1,
        }
      );

      // Calculate commission
      const commissionPct =
        commissionSettings.length > 0
          ? parseFloat(commissionSettings[0].premium_plan_percentage)
          : 0;

      const price = parseFloat(item.price);
      const commissionAmount = (commissionPct / 100) * price;
      const totalPaid = price;

      // Calculate expiration date (example: 1 year from now)
      const expires_at = new Date();
      expires_at.setDate(expires_at.getDate() + 365);

      // Create payment record
      const paymentData = {
        amount: price,
        [item_type]: item_id, // dynamic field based on item_type
        student: userId,
        expires_at: expires_at.toISOString(),
        purchased_at: new Date().toISOString(),
        status: "active",
        razorpay_payment_id,
        razorpay_order_id,
        razorpay_signature,
        price_at_purchase: price,
        commission_percentage_applied: commissionPct,
        commission_amount: commissionAmount,
        total_paid: totalPaid,
      };

      const payment = await strapi.entityService.create(
        "api::payment.payment",
        {
          data: paymentData,
        }
      );

      // Additional logic based on item type
      if (item_type === "classroom") {
        // Add user to classroom or update enrollment status
        await strapi.entityService.update(
          "api::enrollment.enrollment",
          item_id,
          {
            data: {
              student: userId,
              status: "active",
              payment: payment.id,
            },
          }
        );
      }

      return {
        success: true,
        payment,
        commission: {
          percentage: commissionPct,
          amount: commissionAmount,
        },
      };
    } catch (error) {
      console.error("Payment processing error:", error);
      return ctx.internalServerError("Payment processing failed");
    }
  },
};

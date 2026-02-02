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
  async createOrder(ctx) {
    try {
      const { amount } = ctx.request.body;

      if (!amount) {
        return ctx.badRequest("Amount is required");
      }

      // 🔐 Get logged-in user
      const user = ctx.state.user;
      if (!user) {
        return ctx.unauthorized("User not logged in");
      }

      // ✅ Get Razorpay instance for this user
      const { razorpay, isTestUser } =
        await getRazorpayInstanceForUser(user.id);

      // ✅ Create order
      const order = await razorpay.orders.create({
        amount: amount * 100, // paise
        currency: "INR",
        receipt: `rcpt_${Date.now()}`,
      });

      return {
        orderId: order.id,   // 👈 THIS is the ID you’re looking for
        isTestUser,
      };
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
        gradeSubjectId,
        mentorOrCounsellorId,
        system_plan,
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
        "api::user-grade-plan.user-grade-plan",
        gradeSubjectId,
        {
          populate: [], // expand if you need creator or other relations
        }
      );

      if (!plan) {
        return ctx.badRequest("Invalid plan");
      }

      const now = new Date().toISOString();
      let commissionPct = 0; // default to zero if none set

      console.log("plan tye:", plan.type);

      const commissionSettings = await strapi.entityService.findMany(
        "api::commission-setting.commission-setting",
        {
          filters: {
            system_plan: plan?.type === system_plan,
            is_active: true,
            effective_from: { $lte: now },
          },
          sort: { effective_from: "desc" },
          limit: 1,
        }
      );
      if (commissionSettings.length > 0) {
        commissionPct =
          parseFloat(commissionSettings[0].commission_percentage) || 0;
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
        gradeSubjectId,
        razorpay_order_id,
        razorpay_payment_id,
      });

      // Create user plan record
      try {
        const userPlan = await strapi.entityService.create(
          "api::user-grade-plan.user-grade-plan",
          {
            data: {
              grade_subject: gradeSubjectId,
              razorpay_order_id,
              razorpay_payment_id,
              status: "active",
              purchased_at,
              remaining_hours: plan.hours_included || 0,
              student: userId,
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
};

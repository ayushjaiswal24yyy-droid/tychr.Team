// const Razorpay = require("razorpay");
// const crypto = require('crypto');

// module.exports = {
//   async verifyOrder(ctx) {
//     const { amount, student, premium_plan, plan_duration_days, plan_hours } =
//       ctx.request.body;

//     if (!amount) {
//       return ctx.badRequest("Amount is required");
//     }

//     // Optional: validate student, premium_plan etc. as needed

//     const razorpay = new Razorpay({
//       key_id: process.env.RAZORPAY_KEY_ID,
//       key_secret: process.env.RAZORPAY_SECRET_ID,
//     });

//     try {
//       const order = await razorpay.orders.create({
//         amount: Math.round(amount * 100), // to paise
//         currency: "INR",
//         receipt: `receipt_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
//         notes: {
//           student: student ? String(student) : "",
//           premium_plan: premium_plan ? String(premium_plan) : "",
//         },
//       });

//       // Return order details to frontend
//       return ctx.send({ order });
//     } catch (err) {
//       strapi.log.error("Razorpay order creation failed:", err);
//       return ctx.internalServerError("Failed to create Razorpay order");
//     }
//   },

//   /**
//    * Verify payment and create user-plan record
//    * POST /api/razorpay/verify
//    */
//   async verifyPayment(ctx) {
//     const {
//       razorpay_order_id,
//       razorpay_payment_id,
//       razorpay_signature,
//       student,
//       premium_plan,
//       plan_duration_days = 30,
//       plan_hours = 10,
//     } = ctx.request.body;

//     if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
//       return ctx.badRequest("Missing payment verification payload");
//     }

//     // Generate signature and verify
//     const generated_signature = crypto
//       .createHmac("sha256", process.env.RAZORPAY_SECRET_ID)
//       .update(`${razorpay_order_id}|${razorpay_payment_id}`)
//       .digest("hex");

//     const isAuthentic = generated_signature === razorpay_signature;

//     if (!isAuthentic) {
//       return ctx.badRequest("Payment verification failed: signature mismatch");
//     }

//     try {
//       // Compute expiry and other plan-related fields
//       const purchased_at = new Date().toISOString();
//       const expires_at = new Date(
//         Date.now() + plan_duration_days * 24 * 60 * 60 * 1000
//       ).toISOString();

//       // Create the user-plan entry using Strapi entity service
//       const userPlan = await strapi.entityService.create(
//         "api::user-plan.user-plan",
//         {
//           data: {
//             razorpay_order_id,
//             razorpay_payment_id,
//             razorpay_signature,
//             status: "active",
//             purchased_at,
//             expires_at,
//             remaining_hours: plan_hours,
//             student, // assumes relation by ID
//             premium_plan, // assumes relation by ID
//           },
//         }
//       );

//       return ctx.send({
//         success: true,
//         message: "Payment verified and user plan created",
//         userPlan,
//       });
//     } catch (err) {
//       strapi.log.error("Failed to create user-plan:", err);
//       return ctx.internalServerError(
//         "Failed to create user plan after verification"
//       );
//     }
//   },
// };

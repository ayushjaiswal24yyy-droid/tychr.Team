"use strict";

const Razorpay = require("razorpay");
const crypto = require("crypto");

// Initialize Razorpay

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
  // Create Razorpay order
  async createOrder(ctx) {
    try {
      console.log("=== CREATE ADD-ON ORDER ===");
      console.log("Request body:", ctx.request.body);

      const {
        amount,
        currency = "INR",
        receipt,
        add_on_content_id,
      } = ctx.request.body;

      // Validate inputs
      if (!amount || !add_on_content_id) {
        console.error("Missing required fields:", {
          amount,
          add_on_content_id,
        });
        return ctx.badRequest("Amount and content ID are required");
      }

      // Get user from token
      const token = ctx.request.header.authorization?.replace("Bearer ", "");
      if (!token) {
        console.error("No authorization token");
        return ctx.unauthorized("Authorization token missing");
      }

      let user;
      try {
        const decoded = await strapi.plugins[
          "users-permissions"
        ].services.jwt.verify(token);
        user = await strapi.entityService.findOne(
          "plugin::users-permissions.user",
          decoded.id
        );
        if (!user) {
          console.error("User not found with ID:", decoded.id);
          return ctx.unauthorized("User not found");
        }
        console.log("User found:", user.id, user.username);
      } catch (error) {
        console.error("JWT verification error:", error.message);
        return ctx.unauthorized("Invalid or expired token");
      }
      const { razorpay, isTestUser } = await getRazorpayInstanceForUser(user.id);
      // Check if already purchased (checking by order existence)
      const existingOrder = await strapi.db
        .query("api::add-on-order.add-on-order")
        .findOne({
          where: {
            users_permissions_user: user.id,
            add_on_content: add_on_content_id,
            is_active: true,
          },
        });

      if (existingOrder) {
        console.log("Already purchased - order exists:", existingOrder.id);
        return ctx.badRequest("You have already purchased this content");
      }

      // Get the add-on content to validate
      const addOnContent = await strapi.entityService.findOne(
        "api::add-on-content.add-on-content",
        parseInt(add_on_content_id)
      );

      if (!addOnContent) {
        console.error("Add-on content not found with ID:", add_on_content_id);
        return ctx.badRequest("Content not found");
      }

      console.log(
        "Add-on content found:",
        addOnContent.name,
        "Price:",
        addOnContent.price
      );

      // Create Razorpay order
      let razorpayOrder;
      try {
        razorpayOrder = await razorpay.orders.create({
          amount: Math.round(parseFloat(amount)), // Amount already in paise from frontend
          currency: currency,
          receipt: receipt || `addon_${add_on_content_id}_${Date.now()}`,
          payment_capture: 1,
          notes: {
            user_id: user.id,
            add_on_content_id: add_on_content_id,
            type: "add_on_purchase",
          },
        });
        console.log("Razorpay order created successfully:", razorpayOrder.id);
      } catch (razorpayError) {
        console.error("Razorpay API error:", razorpayError.message);
        console.error("Razorpay error details:", razorpayError.error);
        throw new Error(`Razorpay error: ${razorpayError.message}`);
      }

      // Create pending payment record in your database
      const paymentData = {
        add_on_content: parseInt(add_on_content_id), // This should be the ID, not the object
        users_permissions_user: user.id,
        price: amount / 100, // Convert from paise to rupees
        purchased_at: new Date(),
        expires_at: new Date(
          new Date().setFullYear(new Date().getFullYear() + 1)
        ), // Default 1 year
        is_active: true,
        razorpay_order_id: razorpayOrder.id,
        razorpay_payment_id: null,
        razorpay_signature: null,
        price_at_purchase: amount / 100,
        commission_percentage_applied: 0,
        commission_amount: 0,
        total_paid: amount / 100,
        status: "pending", // Add this field for tracking
      };

      console.log("Creating payment record with data:", paymentData);

      let paymentRecord;
      try {
        paymentRecord = await strapi.entityService.create(
          "api::add-on-order.add-on-order",
          { data: paymentData }
        );
        console.log("Payment record created successfully:", paymentRecord.id);
      } catch (dbError) {
        console.error("Database error creating payment:", dbError.message);
        console.error("DB error details:", dbError);
        throw new Error(`Database error: ${dbError.message}`);
      }

      return {
        success: true,
        id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        receipt: razorpayOrder.receipt,
        payment_id: paymentRecord.id,
        razorpay_key: isTestUser
          ? process.env.RAZORPAY_TEST_KEY_ID
          : process.env.RAZORPAY_LIVE_KEY_ID,
        message: "Order created successfully",
      };
    } catch (error) {
      console.error("=== CREATE ORDER ERROR ===");
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
      console.error("Full error:", error);

      return ctx.internalServerError(error.message || "Failed to create order");
    }
  },

  // Verify and complete payment
  async verifyPayment(ctx) {
    try {
      console.log("=== VERIFY ADD-ON PAYMENT ===");
      console.log("Request body:", ctx.request.body);

      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        payment_id,
      } = ctx.request.body;

      if (
        !razorpay_order_id ||
        !razorpay_payment_id ||
        !razorpay_signature ||
        !payment_id
      ) {
        return ctx.badRequest("Missing required fields");
      }

      // 1️⃣ Fetch payment + user FIRST
      const payment = await strapi.entityService.findOne(
        "api::add-on-order.add-on-order",
        Number(payment_id),
        { populate: ["add_on_content", "users_permissions_user"] }
      );

      if (!payment) {
        return ctx.badRequest("Payment record not found");
      }

      // Already completed → idempotent response
      if (payment.razorpay_payment_id) {
        return {
          success: true,
          message: "Payment already completed",
          data: payment,
        };
      }

      // 2️⃣ Decide environment from DB
      const isTestUser =
        payment.users_permissions_user?.is_test_user === true;

      const secret = isTestUser
        ? process.env.RAZORPAY_TEST_SECRET_ID
        : process.env.RAZORPAY_LIVE_SECRET_ID;

      // 3️⃣ Verify signature ONCE with correct secret
      const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest("hex");

      if (expectedSignature !== razorpay_signature) {
        console.error("Signature mismatch");
        return ctx.badRequest("Invalid payment signature");
      }

      // 4️⃣ Create Razorpay instance for optional API verification
      const razorpay = new Razorpay({
        key_id: isTestUser
          ? process.env.RAZORPAY_TEST_KEY_ID
          : process.env.RAZORPAY_LIVE_KEY_ID,
        key_secret: secret,
      });

      // Optional but good practice
      try {
        const razorpayPayment = await razorpay.payments.fetch(
          razorpay_payment_id
        );

        if (razorpayPayment.status !== "captured") {
          return ctx.badRequest(
            `Payment not captured. Status: ${razorpayPayment.status}`
          );
        }
      } catch (err) {
        console.warn(
          "Razorpay fetch failed, continuing:",
          err.message
        );
      }

      // 5️⃣ Calculate expiry
      let expires_at = new Date();
      if (payment.add_on_content?.validity_in_months) {
        expires_at.setMonth(
          expires_at.getMonth() +
          payment.add_on_content.validity_in_months
        );
      } else {
        expires_at.setFullYear(expires_at.getFullYear() + 1);
      }

      // 6️⃣ Mark payment completed
      const updatedPayment = await strapi.entityService.update(
        "api::add-on-order.add-on-order",
        payment.id,
        {
          data: {
            razorpay_payment_id,
            razorpay_signature,
            expires_at,
            status: "completed",
          },
        }
      );

      return {
        success: true,
        message: "Payment verified and completed successfully",
        data: {
          payment_id: updatedPayment.id,
          content_name: payment.add_on_content?.name,
          expires_at,
          access_granted: true,
          environment: isTestUser ? "test" : "live",
        },
      };
    } catch (error) {
      console.error("VERIFY PAYMENT ERROR:", error);
      return ctx.internalServerError(
        error.message || "Payment verification failed"
      );
    }
  },


  // Handle failed payment
  async handleFailedPayment(ctx) {
    try {
      console.log("=== HANDLE FAILED PAYMENT ===");
      const { payment_id } = ctx.request.body;

      if (!payment_id) {
        return ctx.badRequest("Payment ID required");
      }

      await strapi.entityService.update(
        "api::add-on-order.add-on-order",
        parseInt(payment_id),
        {
          data: {
            status: "failed",
            is_active: false,
          },
        }
      );

      console.log("Payment marked as failed:", payment_id);

      return {
        success: true,
        message: "Payment marked as failed",
      };
    } catch (error) {
      console.error("Handle failed payment error:", error);
      return ctx.internalServerError("Failed to update payment status");
    }
  },
};

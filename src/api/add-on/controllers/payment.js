"use strict";

const Razorpay = require("razorpay");
const crypto = require("crypto");

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_SECRET_ID,
});

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
        razorpay_key: process.env.RAZORPAY_KEY_ID,
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

      // Validate inputs
      if (
        !razorpay_order_id ||
        !razorpay_payment_id ||
        !razorpay_signature ||
        !payment_id
      ) {
        console.error("Missing required fields:", {
          razorpay_order_id: !!razorpay_order_id,
          razorpay_payment_id: !!razorpay_payment_id,
          razorpay_signature: !!razorpay_signature,
          payment_id: !!payment_id,
        });
        return ctx.badRequest("Missing required fields");
      }

      // Verify signature
      const generatedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_SECRET_ID)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest("hex");

      console.log("Signature comparison:", {
        generated: generatedSignature.substring(0, 20) + "...",
        received: razorpay_signature.substring(0, 20) + "...",
        match: generatedSignature === razorpay_signature,
      });

      if (generatedSignature !== razorpay_signature) {
        console.error("Signature verification failed");
        return ctx.badRequest("Invalid payment signature");
      }

      // Get payment record
      const payment = await strapi.entityService.findOne(
        "api::add-on-order.add-on-order",
        parseInt(payment_id),
        { populate: ["add_on_content", "users_permissions_user"] }
      );

      if (!payment) {
        console.error("Payment record not found with ID:", payment_id);
        return ctx.badRequest("Payment record not found");
      }

      // Check if already completed
      if (payment.razorpay_payment_id) {
        console.log("Payment already completed");
        return {
          success: true,
          message: "Payment already completed",
          data: payment,
        };
      }

      // Verify with Razorpay API (optional but recommended)
      try {
        const razorpayPayment = await razorpay.payments.fetch(
          razorpay_payment_id
        );
        console.log("Razorpay payment status:", razorpayPayment.status);

        if (razorpayPayment.status !== "captured") {
          console.error(
            "Payment not captured. Status:",
            razorpayPayment.status
          );
          return ctx.badRequest(
            `Payment not captured. Status: ${razorpayPayment.status}`
          );
        }
      } catch (razorpayError) {
        console.warn(
          "Razorpay verification failed (continuing anyway):",
          razorpayError.message
        );
        // Continue anyway since signature verification passed
      }

      // Calculate expiration date based on content validity
      let expires_at = new Date();
      if (payment.add_on_content?.validity_in_months) {
        expires_at.setMonth(
          expires_at.getMonth() + payment.add_on_content.validity_in_months
        );
        console.log(
          "Setting expiration to:",
          expires_at,
          "based on",
          payment.add_on_content.validity_in_months,
          "months"
        );
      } else {
        expires_at.setFullYear(expires_at.getFullYear() + 1); // Default 1 year
        console.log("Setting expiration to default 1 year:", expires_at);
      }

      // Update payment record
      const updatedPayment = await strapi.entityService.update(
        "api::add-on-order.add-on-order",
        parseInt(payment_id),
        {
          data: {
            razorpay_payment_id,
            razorpay_signature,
            expires_at,
            status: "completed",
          },
        }
      );

      console.log("Payment completed successfully:", payment_id);

      return {
        success: true,
        message: "Payment verified and completed successfully",
        data: {
          payment_id: updatedPayment.id,
          content_name: payment.add_on_content?.name,
          expires_at: expires_at,
          access_granted: true,
        },
      };
    } catch (error) {
      console.error("=== VERIFY PAYMENT ERROR ===");
      console.error("Error:", error.message);
      console.error("Stack:", error.stack);
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

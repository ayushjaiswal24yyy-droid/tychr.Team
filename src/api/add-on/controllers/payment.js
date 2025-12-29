const Razorpay = require("razorpay");
const crypto = require("crypto");

// Initialize Razorpay with proper error handling
let razorpay;
try {
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_SECRET_ID,
  });
} catch (error) {
  console.error("Razorpay initialization failed:", error);
}

module.exports = {
  async completeAddOnTransaction(ctx) {
    console.log("🚀 Starting completeAddOnTransaction API call");

    try {
      // Log incoming request
      console.log("📥 Request body:", ctx.request.body);
      console.log("📋 Request headers:", ctx.request.headers);

      // Extract and validate data
      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        add_on_content_id,
      } = ctx.request.body;

      console.log("🔍 Extracted data:", {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature: razorpay_signature ? "Present" : "Missing",
        add_on_content_id,
        add_on_content_id_type: typeof add_on_content_id,
      });

      // Validate required fields
      if (
        !razorpay_order_id ||
        !razorpay_payment_id ||
        !razorpay_signature ||
        !add_on_content_id
      ) {
        console.error("❌ Missing required fields:", {
          razorpay_order_id: !razorpay_order_id,
          razorpay_payment_id: !razorpay_payment_id,
          razorpay_signature: !razorpay_signature,
          add_on_content_id: !add_on_content_id,
        });
        return ctx.badRequest("Missing required payment fields");
      }

      // Verify the payment signature
      console.log("🔐 Verifying payment signature...");
      const generatedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_SECRET_ID)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest("hex");

      console.log("📝 Signature comparison:", {
        generated: generatedSignature,
        received: razorpay_signature,
        match: generatedSignature === razorpay_signature,
      });

      if (generatedSignature !== razorpay_signature) {
        console.error("❌ Payment signature verification failed");
        return ctx.badRequest(
          "Payment verification failed - invalid signature"
        );
      }
      console.log("✅ Payment signature verified successfully");

      // Get user from token
      const token = ctx.request.header.authorization?.replace("Bearer ", "");
      if (!token) {
        return ctx.unauthorized("Authorization token missing");
      }

      let user;
      try {
        const decoded = await strapi.plugins[
          "users-permissions"
        ].services.jwt.verify(token);
        user = await strapi.entityService.findOne(
          "plugin::users-permissions.user",
          decoded.id,
          {
            populate: "*",
          }
        );

        if (!user) {
          return ctx.badRequest("User not found");
        }
        console.log("✅ User verified:", user.id, user.username);
      } catch (jwtError) {
        console.error("❌ JWT verification failed:", jwtError);
        return ctx.unauthorized("Invalid or expired token");
      }

      // Parse add_on_content_id to integer
      const contentId = parseInt(add_on_content_id);
      if (isNaN(contentId)) {
        return ctx.badRequest("Invalid add-on content ID format");
      }

      // Verify the add-on content exists
      console.log("📦 Fetching add-on-content with ID:", contentId);
      let addOnContent;
      try {
        addOnContent = await strapi.entityService.findOne(
          "api::add-on-content.add-on-content",
          contentId,
          {
            populate: {
              add_on: true,
            },
          }
        );

        if (!addOnContent) {
          return ctx.badRequest("Add-on content not found");
        }
        console.log("✅ Add-on-content found:", addOnContent.name);
      } catch (error) {
        console.error("❌ Add-on-content fetch error:", error);
        return ctx.badRequest("Failed to fetch add-on content");
      }

      // Check if payment already exists for this order
      const existingOrder = await strapi.db
        .query("api::add-on-order.add-on-order")
        .findOne({
          where: {
            razorpay_order_id: razorpay_order_id,
            razorpay_payment_id: razorpay_payment_id,
          },
        });

      if (existingOrder) {
        console.log("⚠️ Payment already processed for this order");
        return ctx.badRequest("Payment already processed");
      }

      // Verify with Razorpay API that payment is successful
      try {
        // This step ensures the payment is actually captured by Razorpay
        const payment = await razorpay.payments.fetch(razorpay_payment_id);
        console.log("💰 Razorpay payment status:", payment.status);

        if (payment.status !== "captured") {
          return ctx.badRequest(
            `Payment not captured. Status: ${payment.status}`
          );
        }
      } catch (razorpayError) {
        console.error(
          "❌ Razorpay payment verification failed:",
          razorpayError
        );
        return ctx.badRequest("Failed to verify payment with Razorpay");
      }

      // Get price and validate
      const price = parseFloat(addOnContent.price) || 0;
      if (price <= 0) {
        return ctx.badRequest("Invalid price for add-on content");
      }

      // Calculate commission
      const commissionPct = 0; // Set your commission logic here
      const commissionAmount = (commissionPct / 100) * price;
      const totalPaid = price;

      // Calculate expiration date
      const expires_at = new Date();
      if (addOnContent.validity_in_months) {
        expires_at.setMonth(
          expires_at.getMonth() + addOnContent.validity_in_months
        );
      } else {
        expires_at.setFullYear(expires_at.getFullYear() + 1);
      }

      // Create the payment record
      console.log("💳 Creating payment record...");
      const paymentData = {
        price: price,
        add_on_content: contentId,
        users_permissions_user: user.id,
        expires_at: expires_at.toISOString(),
        purchased_at: new Date().toISOString(),
        is_active: true,
        razorpay_payment_id,
        razorpay_order_id,
        razorpay_signature,
        price_at_purchase: price,
        commission_percentage_applied: commissionPct,
        commission_amount: commissionAmount,
        total_paid: totalPaid,
      };

      let payment;
      try {
        payment = await strapi.entityService.create(
          "api::add-on-order.add-on-order",
          {
            data: paymentData,
            populate: ["add_on_content", "users_permissions_user"],
          }
        );
        console.log("✅ Payment record created:", payment.id);
      } catch (paymentError) {
        console.error("❌ Payment creation failed:", paymentError);
        return ctx.internalServerError("Failed to create payment record");
      }

      // Return success response
      return {
        success: true,
        message: "Payment processed successfully",
        data: {
          payment_id: payment.id,
          order_id: razorpay_order_id,
          add_on_content: {
            id: addOnContent.id,
            name: addOnContent.name,
            price: price,
          },
          user: {
            id: user.id,
            username: user.username,
          },
          expires_at: expires_at.toISOString(),
        },
      };
    } catch (error) {
      console.error("💥 Complete transaction error:", error);
      console.error("Stack trace:", error.stack);

      return ctx.internalServerError(
        `Payment processing failed: ${error.message}`
      );
    }
  },
};

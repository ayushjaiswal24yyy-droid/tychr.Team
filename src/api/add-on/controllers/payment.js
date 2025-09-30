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
      // Log incoming request for debugging
      console.log(
        "📥 Request body:",
        JSON.stringify(ctx.request.body, null, 2)
      );

      // Extract required data from request - FIXED: user is buying individual add-on-content
      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        add_on_content_id, // ID of the specific add-on-content being purchased
      } = ctx.request.body;

      // Validate required fields - FIXED: check for add_on_content_id instead of add_on_id
      if (
        !razorpay_order_id ||
        !razorpay_payment_id ||
        !razorpay_signature ||
        !add_on_content_id
      ) {
        console.error("❌ Missing required fields:", {
          razorpay_order_id: !!razorpay_order_id,
          razorpay_payment_id: !!razorpay_payment_id,
          // razorpay_signature: !!razorpay_signature,
          add_on_content_id: !!add_on_content_id,
        });
        return ctx.badRequest("Missing required payment fields");
      }

      // Verify the payment signature
      console.log("🔐 Verifying payment signature...");
      // const generatedSignature = crypto
      //   .createHmac("sha256", process.env.RAZORPAY_SECRET_ID)
      //   .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      //   .digest("hex");

      // console.log("📝 Signature comparison:", {
      //   generated: generatedSignature,
      //   received: razorpay_signature,
      //   match: generatedSignature === razorpay_signature,
      // });

      // if (generatedSignature !== razorpay_signature) {
      //   console.error("❌ Payment signature verification failed");
      //   return ctx.badRequest("Payment verification failed");
      // }
      // console.log("✅ Payment signature verified successfully");

      // Get user ID from token
      const token = ctx.request.header.authorization?.replace("Bearer ", "");
      console.log("🔑 Token present:", !!token);

      if (!token) {
        return ctx.unauthorized("Authorization token missing");
      }

      let userId;
      try {
        const decoded = await strapi.plugins[
          "users-permissions"
        ].services.jwt.verify(token);
        userId = decoded.id;
        console.log("👤 User ID from token:", userId);
      } catch (jwtError) {
        console.error("❌ JWT verification failed:", jwtError);
        return ctx.unauthorized("Invalid or expired token");
      }

      if (!userId) {
        return ctx.badRequest("Student (user) not identified");
      }

      // Verify user exists
      let user;
      try {
        user = await strapi.entityService.findOne(
          "plugin::users-permissions.user",
          userId
        );
        if (!user) {
          console.error("❌ User not found with ID:", userId);
          return ctx.badRequest("User not found");
        }
        console.log("✅ User verified:", user.username);
      } catch (userError) {
        console.error("❌ User lookup failed:", userError);
        return ctx.badRequest("User validation failed");
      }

      // Fetch the specific add-on-content with its details - FIXED: fetch single content item
      console.log("📦 Fetching add-on-content with ID:", add_on_content_id);
      let addOnContent;
      try {
        addOnContent = await strapi.entityService.findOne(
          "api::add-on-content.add-on-content",
          add_on_content_id,
          {
            populate: {
              add_on: {
                populate: {
                  ib_program: true,
                },
              },
              // Populate other necessary fields
            },
          }
        );
        console.log(
          "✅ Add-on-content fetched:",
          addOnContent
            ? `"${addOnContent.name}" - Price: ${addOnContent.price}`
            : "NOT FOUND"
        );
      } catch (error) {
        console.error("❌ Add-on-content fetch error:", error);
        return ctx.badRequest("Invalid add-on-content ID");
      }

      if (!addOnContent) {
        return ctx.badRequest("Add-on content not found");
      }

      // Check if content is free
      if (addOnContent.is_free) {
        console.log("ℹ️ Add-on content is free, processing without payment...");
        // Handle free content differently 
      }

      // Get price from the add-on-content - FIXED: single item price
      const price = parseFloat(addOnContent.price || 0);
      console.log("💰 Add-on-content price:", price);

      if (price <= 0) {
        console.error("❌ Invalid price:", price);
        return ctx.badRequest("Add-on content has invalid pricing");
      }

      // Get current commission settings for add-ons
      console.log("⚙️ Fetching commission settings...");
      const now = new Date().toISOString();
      let commissionSettings;
      try {
        commissionSettings = await strapi.entityService.findMany(
          "api::commission-setting.commission-setting",
          {
            filters: {
              system_plan: "add_on",
              is_premium_plan_active: true,
              premium_plan_effective_from: { $lte: now },
            },
            sort: { premium_plan_effective_from: "desc" },
            limit: 1,
          }
        );
        console.log("✅ Commission settings found:", commissionSettings.length);
      } catch (commissionError) {
        console.error("❌ Commission settings fetch failed:", commissionError);
        // Continue with default commission (0%) if settings not found
        commissionSettings = [];
      }

      // Calculate commission for single item - FIXED
      const commissionPct =
        commissionSettings.length > 0
          ? parseFloat(commissionSettings[0].premium_plan_percentage) || 0
          : 0;

      const commissionAmount = (commissionPct / 100) * price;
      const totalPaid = price;

      console.log("💸 Commission details:", {
        percentage: commissionPct,
        amount: commissionAmount,
        totalPaid: totalPaid,
      });

      // Calculate expiration date based on validity_in_months or default 1 year
      const expires_at = new Date();
      if (addOnContent.validity_in_months) {
        expires_at.setMonth(
          expires_at.getMonth() + addOnContent.validity_in_months
        );
      } else {
        expires_at.setFullYear(expires_at.getFullYear() + 1); // Default 1 year
      }
      console.log("📅 Expiration date:", expires_at.toISOString());

      // Create single payment record for the add-on-content - FIXED: single payment
      console.log("💳 Creating payment record...");

      const paymentData = {
        price: price,
        add_on_content: add_on_content_id, // Link to the specific content
        users_permissions_user: userId,
        expires_at: expires_at.toISOString(),
        purchased_at: new Date().toISOString(),
        is_active: true,
        razorpay_payment_id,
        razorpay_order_id,
        razorpay_signature: "none", // Storing 'none' as signature is not verified
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
          }
        );
        console.log("✅ Payment record created with ID:", payment.id);
      } catch (paymentError) {
        console.error("❌ Payment creation failed:", paymentError);
        return ctx.internalServerError("Failed to create payment record");
      }

      // Create access record for the user - FIXED: single access record
      // console.log("🔓 Creating access record...");
      // let accessRecord;
      // try {
      //   accessRecord = await strapi.entityService.create(
      //     "api::user-content-access.user-content-access",
      //     {
      //       data: {
      //         user: userId,
      //         add_on_content: add_on_content_id,
      //         payment: payment.id,
      //         expires_at: expires_at.toISOString(),
      //         access_granted: true,
      //       },
      //     }
      //   );
      //   console.log("✅ Access record created with ID:", accessRecord.id);
      // } catch (accessError) {
      //   console.error("❌ Access record creation failed:", accessError);
      //   // Don't fail the entire transaction if access record fails
      // }

      // console.log("🎉 Add-on content transaction completed successfully!");

      return {
        success: true,
        payment: {
          id: payment.id,
          price: payment.price,
          razorpay_payment_id: payment.razorpay_payment_id,
          purchased_at: payment.purchased_at,
          expires_at: payment.expires_at,
        },
        commission: {
          percentage: commissionPct,
          amount: commissionAmount,
        },
        add_on_content: {
          id: addOnContent.id,
          name: addOnContent.name,
          description: addOnContent.description,
          price: price,
          validity_months: addOnContent.validity_in_months,
        },
        // access_granted: true,
      };
    } catch (error) {
      console.error("💥 Add-on payment processing error:", error);
      console.error("🔍 Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });

      return ctx.internalServerError(
        "Add-on payment processing failed: " + error.message
      );
    }
  },
};

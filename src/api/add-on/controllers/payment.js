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

      // Extract required data from request
      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        add_on_id, // ID of the add-on being purchased
      } = ctx.request.body;

      // Validate required fields
      if (
        !razorpay_order_id ||
        !razorpay_payment_id ||
        !razorpay_signature ||
        !add_on_id
      ) {
        console.error("❌ Missing required fields:", {
          razorpay_order_id: !!razorpay_order_id,
          razorpay_payment_id: !!razorpay_payment_id,
          razorpay_signature: !!razorpay_signature,
          add_on_id: !!add_on_id,
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
        return ctx.badRequest("Payment verification failed");
      }
      console.log("✅ Payment signature verified successfully");

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

      // Fetch the add-on with its contents and pricing
      console.log("📦 Fetching add-on with ID:", add_on_id);
      let addOn;
      try {
        addOn = await strapi.entityService.findOne(
          "api::add-on.add-on",
          add_on_id,
          {
            populate: {
              add_on_contents: {
                populate: {
                  price: true,
                  creator: true,
                },
              },
              ib_program: true,
            },
          }
        );
        console.log(
          "✅ Add-on fetched:",
          addOn
            ? `"${addOn.Title}" with ${
                addOn.add_on_contents?.length || 0
              } contents`
            : "NOT FOUND"
        );
      } catch (error) {
        console.error("❌ Add-on fetch error:", error);
        return ctx.badRequest("Invalid add-on ID");
      }

      if (!addOn) {
        return ctx.badRequest("Add-on not found");
      }

      if (!addOn.add_on_contents || addOn.add_on_contents.length === 0) {
        console.error("❌ Add-on has no contents:", addOn);
        return ctx.badRequest("Add-on has no content available for purchase");
      }

      // Calculate total price from all add-on contents
      const totalPrice = addOn.add_on_contents.reduce((total, content) => {
        const contentPrice = parseFloat(content.price || 0);
        console.log(`💰 Content ${content.id} price:`, contentPrice);
        return total + contentPrice;
      }, 0);

      console.log("💰 Total calculated price:", totalPrice);

      if (totalPrice <= 0) {
        console.error("❌ Invalid total price:", totalPrice);
        return ctx.badRequest("Add-on has invalid pricing");
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

      // Calculate commission
      const commissionPct =
        commissionSettings.length > 0
          ? parseFloat(commissionSettings[0].premium_plan_percentage) || 0
          : 0;

      const commissionAmount = (commissionPct / 100) * totalPrice;
      const totalPaid = totalPrice;

      console.log("💸 Commission details:", {
        percentage: commissionPct,
        amount: commissionAmount,
        totalPaid: totalPaid,
      });

      // Calculate expiration date (1 year from now)
      const expires_at = new Date();
      expires_at.setFullYear(expires_at.getFullYear() + 1);
      console.log("📅 Expiration date:", expires_at.toISOString());

      // Create payment record for EACH add-on content (since schema expects one content per order)
      console.log("💳 Creating payment records for each content...");
      const paymentRecords = [];
      const accessRecords = [];

      for (const content of addOn.add_on_contents) {
        try {
          const contentPrice = parseFloat(content.price || 0);
          const contentCommissionAmount = (commissionPct / 100) * contentPrice;

          const paymentData = {
            price: contentPrice,
            add_on_content: content.id, // This matches your schema
            users_permissions_user: userId,
            expires_at: expires_at.toISOString(),
            purchased_at: new Date().toISOString(),
            is_active: true,
            razorpay_payment_id,
            razorpay_order_id,
            razorpay_signature,
            price_at_purchase: contentPrice,
            commission_percentage_applied: commissionPct,
            commission_amount: contentCommissionAmount,
            total_paid: contentPrice,
          };

          console.log(`➡️ Creating payment for content ${content.id}...`);
          const payment = await strapi.entityService.create(
            "api::add-on-order.add-on-order",
            {
              data: paymentData,
            }
          );
          paymentRecords.push(payment);

          // Create access record
          console.log(`🔓 Creating access for content ${content.id}...`);
          const accessRecord = await strapi.entityService.create(
            "api::user-content-access.user-content-access",
            {
              data: {
                user: userId,
                add_on_content: content.id,
                payment: payment.id,
                expires_at: expires_at.toISOString(),
                access_granted: true,
              },
            }
          );
          accessRecords.push(accessRecord);
          console.log(
            `✅ Payment and access created for content ${content.id}`
          );
        } catch (contentError) {
          console.error(
            `❌ Failed to process content ${content.id}:`,
            contentError
          );
          // Continue with other contents even if one fails
        }
      }

      if (paymentRecords.length === 0) {
        console.error("❌ No payment records were created");
        return ctx.internalServerError("Failed to create any payment records");
      }

      console.log("🎉 Add-on transaction completed successfully!");

      return {
        success: true,
        payments: paymentRecords.map((p) => ({
          id: p.id,
          price: p.price,
          razorpay_payment_id: p.razorpay_payment_id,
        })),
        commission: {
          percentage: commissionPct,
          amount: commissionAmount,
        },
        add_on: {
          id: addOn.id,
          title: addOn.Title,
          contents_count: addOn.add_on_contents.length,
          total_price: totalPrice,
        },
        access_granted: accessRecords.length,
        total_contents: addOn.add_on_contents.length,
        payments_created: paymentRecords.length,
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

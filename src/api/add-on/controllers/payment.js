const Razorpay = require("razorpay");
const crypto = require("crypto");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_SECRET_ID,
});

module.exports = {
  async completeAddOnTransaction(ctx) {
    try {
      // Extract required data from request
      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        add_on_id, // ID of the add-on being purchased
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

      // Fetch the add-on with its contents and pricing
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
      } catch (error) {
        return ctx.badRequest("Invalid add-on ID");
      }

      if (!addOn) {
        return ctx.badRequest("Add-on not found");
      }

      if (!addOn.add_on_contents || addOn.add_on_contents.length === 0) {
        return ctx.badRequest("Add-on has no content available for purchase");
      }

      // Calculate total price from all add-on contents
      const totalPrice = addOn.add_on_contents.reduce((total, content) => {
        return total + parseFloat(content.price || 0);
      }, 0);

      if (totalPrice <= 0) {
        return ctx.badRequest("Add-on has invalid pricing");
      }

      // Get current commission settings for add-ons
      const now = new Date().toISOString();
      const commissionSettings = await strapi.entityService.findMany(
        "api::commission-setting.commission-setting",
        {
          filters: {
            system_plan: "add_on", // 'add_on' as a system plan type
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

      const commissionAmount = (commissionPct / 100) * totalPrice;
      const totalPaid = totalPrice;

      // Calculate expiration date (example: 1 year from now)
      const expires_at = new Date();
      expires_at.setDate(expires_at.getDate() + 365);

      // Create payment record
      const paymentData = {
        amount: totalPrice,
        add_on: add_on_id,
        student: userId,
        expires_at: expires_at.toISOString(),
        purchased_at: new Date().toISOString(),
        status: "active",
        razorpay_payment_id,
        razorpay_order_id,
        razorpay_signature,
        price_at_purchase: totalPrice,
        commission_percentage_applied: commissionPct,
        commission_amount: commissionAmount,
        total_paid: totalPaid,
        item_type: "add_on", // Add explicit item type for filtering
      };

      const payment = await strapi.entityService.create(
        "api::payment.payment",
        {
          data: paymentData,
        }
      );

      // Grant access to all add-on contents for the user
      for (const content of addOn.add_on_contents) {
        // Assuming you have a user-content access table or relation
        // This part depends on your content access implementation
        await strapi.entityService.create(
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
      }

      return {
        success: true,
        payment,
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
      };
    } catch (error) {
      console.error("Add-on payment processing error:", error);
      return ctx.internalServerError("Add-on payment processing failed");
    }
  },
};

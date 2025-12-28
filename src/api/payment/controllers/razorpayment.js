"use strict";

const Razorpay = require("razorpay");
const crypto = require("crypto");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_SECRET_ID,
});

// Helper function to count weekdays between dates
const countWeekdaysBetweenDates = (startDate, endDate, weekdays) => {
  let count = 0;
  const dayMap = {
    Sunday: 0,
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6,
  };

  const targetDays = weekdays.map((day) => dayMap[day]);
  const currentDate = new Date(startDate);
  const end = new Date(endDate);

  currentDate.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  while (currentDate <= end) {
    if (targetDays.includes(currentDate.getDay())) {
      count++;
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return count;
};

module.exports = {
  // ==================== HELPER FUNCTIONS ====================

  async getGSTRate() {
    try {
      const gstData = await strapi.entityService.findMany("api::gst.gst", {
        filters: { is_active: true },
        limit: 1,
      });
      return gstData.length > 0 ? parseFloat(gstData[0].gst_rate) : 18;
    } catch (error) {
      return 18;
    }
  },

  async getCommissionRate(systemPlan = "classroom") {
    try {
      const commissionData = await strapi.entityService.findMany(
        "api::commission-setting.commission-setting",
        {
          filters: {
            system_plan: systemPlan,
            is_active: true,
          },
          sort: { effective_from: "desc" },
          limit: 1,
        }
      );
      return commissionData.length > 0
        ? parseFloat(commissionData[0].commission_percentage)
        : 10;
    } catch (error) {
      return 10;
    }
  },

  // ==================== MAIN CONTROLLERS ====================

  // 1. CREATE CLASSROOM ORDER (Initial Purchase)
  async createClassroomOrder(ctx) {
    try {
      const {
        enrollment_id,
        include_live_lectures = false,
        include_test_series = false,
      } = ctx.request.body;

      console.log("=== CREATE CLASSROOM ORDER ===");
      console.log("Request:", {
        enrollment_id,
        include_live_lectures,
        include_test_series,
      });

      // Get student from token
      const token = ctx.request.header.authorization?.replace("Bearer ", "");
      if (!token) {
        return ctx.unauthorized("Authorization token missing");
      }

      const { id: studentId } = await strapi.plugins[
        "users-permissions"
      ].services.jwt.verify(token);

      console.log("Student ID:", studentId);

      // Check if subscription already exists (only check for active ones)
      const existingSubscription = await strapi.db
        .query("api::subscription.subscription")
        .findOne({
          where: {
            classroom: enrollment_id,
            student: studentId,
            status: { $in: ["active", "pending"] },
          },
        });

      if (existingSubscription) {
        return ctx.badRequest("Already subscribed to this classroom");
      }

      // Get enrollment details
      const enrollment = await strapi.entityService.findOne(
        "api::enrollment.enrollment",
        enrollment_id,
        {
          populate: ["days", "grade_subject"],
        }
      );

      if (!enrollment) {
        return ctx.badRequest("Enrollment not found");
      }

      // Calculate price
      const calculation = await this.calculateClassroomPrice(
        enrollment,
        include_live_lectures,
        include_test_series
      );

      console.log("Price calculation:", calculation);

      // Create Razorpay order
      const orderData = {
        amount: Math.round(calculation.totalAmount * 100),
        currency: "INR",
        receipt: `classroom_${enrollment_id}_${Date.now()}`,
        notes: {
          student_id: studentId,
          enrollment_id,
          type: include_live_lectures
            ? "classroom_with_live"
            : "classroom_only",
        },
        payment_capture: 1,
      };

      console.log("Creating Razorpay order:", orderData);

      let order;
      try {
        order = await razorpay.orders.create(orderData);
        console.log("Razorpay order created:", order.id);
      } catch (razorpayError) {
        console.error("Razorpay error:", razorpayError);
        throw new Error(`Razorpay error: ${razorpayError.message}`);
      }

      // Create subscription ONLY with pending status
      const subscriptionData = {
        student: studentId,
        classroom: enrollment_id,
        is_classroom_purchased: false, // Will be true only after payment
        is_live_lectures_purchased: false, // Will be true only after payment if included
        is_test_series_purchased: false, // Will be true only after payment if included
        status: "pending", // Important: Keep as pending until payment
        valid_until: new Date(
          new Date().setFullYear(new Date().getFullYear() + 1)
        ),
      };

      console.log(
        "Creating subscription with pending status:",
        subscriptionData
      );

      const subscription = await strapi.entityService.create(
        "api::subscription.subscription",
        { data: subscriptionData }
      );

      console.log("Subscription created with pending status:", subscription.id);

      // Create payment record
      const paymentData = {
        subscription: subscription.id,
        payment_type: include_live_lectures
          ? "classroom_with_live"
          : "classroom_only",
        amount: calculation.totalAmount,
        status: "pending",
        razorpay_order_id: order.id,
        items: {
          classroom: true,
          live_lectures_count: include_live_lectures
            ? calculation.numberOfLectures
            : 0,
          test_series: include_test_series,
          test_series_price: calculation.testSeriesPrice,
        },
        price_details: {
          classroom_price: calculation.basePrice,
          live_lecture_price: calculation.liveLecturesPrice,
          test_series_price: calculation.testSeriesPrice,
          commission: calculation.commissionAmount,
          gst: calculation.gstAmount,
          total: calculation.totalAmount,
        },
        metadata: {
          enrollment_name: enrollment.classroom_name,
          purchase_type: "initial",
          calculation: calculation,
          include_live_lectures: include_live_lectures,
          include_test_series: include_test_series,
        },
      };

      console.log("Creating payment:", paymentData);

      const payment = await strapi.entityService.create(
        "api::payment.payment",
        {
          data: paymentData,
        }
      );

      console.log("Payment created:", payment.id);

      return {
        success: true,
        order,
        subscription_id: subscription.id,
        payment_id: payment.id,
        calculation,
        razorpay_key: process.env.RAZORPAY_KEY_ID,
      };
    } catch (error) {
      console.error("Create classroom order error:", error);
      return ctx.internalServerError(error.message || "Failed to create order");
    }
  },

  // 2. ADD LIVE LECTURES TO EXISTING SUBSCRIPTION
  async addLiveLectures(ctx) {
    try {
      const { enrollment_id, number_of_lectures } = ctx.request.body;

      console.log("=== ADD LIVE LECTURES ===");
      console.log("Request:", { enrollment_id, number_of_lectures });

      // Get student from token
      const token = ctx.request.header.authorization?.replace("Bearer ", "");
      if (!token) {
        return ctx.unauthorized("Authorization token missing");
      }

      const { id: studentId } = await strapi.plugins[
        "users-permissions"
      ].services.jwt.verify(token);

      console.log("Student ID:", studentId);

      // Get active subscription
      const subscription = await strapi.db
        .query("api::subscription.subscription")
        .findOne({
          where: {
            classroom: enrollment_id,
            student: studentId,
            status: "active",
          },
        });

      if (!subscription) {
        return ctx.badRequest("No active subscription found");
      }

      if (!subscription.is_classroom_purchased) {
        return ctx.badRequest("Classroom not purchased yet");
      }

      // Get enrollment for price
      const enrollment = await strapi.entityService.findOne(
        "api::enrollment.enrollment",
        enrollment_id,
        { populate: ["days"] }
      );

      if (!enrollment) {
        return ctx.badRequest("Enrollment not found");
      }

      const lecturePrice = parseFloat(enrollment.lecture_price) || 0;
      const liveLecturesPrice = number_of_lectures * lecturePrice;

      // Calculate taxes
      const gstRate = await this.getGSTRate();
      const commissionRate = await this.getCommissionRate();

      const gstAmount = (liveLecturesPrice * gstRate) / 100;
      const commissionAmount = (liveLecturesPrice * commissionRate) / 100;
      const totalAmount = liveLecturesPrice + commissionAmount + gstAmount;

      console.log("Price calculation:", {
        lecturePrice,
        liveLecturesPrice,
        gstRate,
        gstAmount,
        commissionRate,
        commissionAmount,
        totalAmount,
      });

      // Create Razorpay order
      const orderData = {
        amount: Math.round(totalAmount * 100),
        currency: "INR",
        receipt: `live_addon_${enrollment_id}_${Date.now()}`,
        notes: {
          student_id: studentId,
          enrollment_id,
          type: "live_lectures_addon",
          number_of_lectures,
          subscription_id: subscription.id,
        },
        payment_capture: 1,
      };

      console.log("Creating Razorpay order:", orderData);

      let order;
      try {
        order = await razorpay.orders.create(orderData);
        console.log("Razorpay order created:", order.id);
      } catch (razorpayError) {
        console.error("Razorpay error:", razorpayError);
        throw new Error(`Razorpay error: ${razorpayError.message}`);
      }

      // Create payment record
      const paymentData = {
        subscription: subscription.id,
        payment_type: "live_lectures_addon",
        amount: totalAmount,
        status: "pending",
        razorpay_order_id: order.id,
        items: {
          classroom: false,
          live_lectures_count: number_of_lectures,
          test_series: false,
        },
        price_details: {
          classroom_price: 0,
          live_lecture_price: liveLecturesPrice,
          test_series_price: 0,
          commission: commissionAmount,
          gst: gstAmount,
          total: totalAmount,
        },
        metadata: {
          previous_total_lectures: subscription.total_live_lectures_purchased,
          added_lectures: number_of_lectures,
          purchase_type: "addon",
        },
      };

      console.log("Creating payment:", paymentData);

      const payment = await strapi.entityService.create(
        "api::payment.payment",
        {
          data: paymentData,
        }
      );

      console.log("Payment created:", payment.id);

      return {
        success: true,
        order,
        subscription_id: subscription.id,
        payment_id: payment.id,
        calculation: {
          liveLecturesPrice,
          numberOfLectures: number_of_lectures,
          gstAmount,
          commissionAmount,
          totalAmount,
        },
        razorpay_key: process.env.RAZORPAY_KEY_ID,
      };
    } catch (error) {
      console.error("Add live lectures error:", error);
      return ctx.internalServerError(
        error.message || "Failed to add live lectures"
      );
    }
  },

  // 3. ADD TEST SERIES TO EXISTING SUBSCRIPTION
  async createTestSeriesAddonOrder(ctx) {
    try {
      const { enrollment_id } = ctx.request.body;

      console.log("=== ADD TEST SERIES ===");
      console.log("Request:", { enrollment_id });

      // Get student from token
      const token = ctx.request.header.authorization?.replace("Bearer ", "");
      if (!token) {
        return ctx.unauthorized("Authorization token missing");
      }

      const { id: studentId } = await strapi.plugins[
        "users-permissions"
      ].services.jwt.verify(token);

      console.log("Student ID:", studentId);

      // Get active subscription
      const subscription = await strapi.db
        .query("api::subscription.subscription")
        .findOne({
          where: {
            classroom: enrollment_id,
            student: studentId,
            status: "active",
          },
        });

      if (!subscription) {
        return ctx.badRequest("No active subscription found");
      }

      if (!subscription.is_classroom_purchased) {
        return ctx.badRequest("Classroom not purchased yet");
      }

      if (subscription.is_test_series_purchased) {
        return ctx.badRequest("Test series already purchased");
      }

      // Get test series price
      const enrollment = await strapi.entityService.findOne(
        "api::enrollment.enrollment",
        enrollment_id,
        { populate: ["grade_subject"] }
      );

      if (!enrollment) {
        return ctx.badRequest("Enrollment not found");
      }

      const testSeriesPrice =
        parseFloat(enrollment.grade_subject?.test_series_price) || 0;

      if (testSeriesPrice < 0) {
        return ctx.badRequest("Test series not available");
      }

      // If test series is free (price = 0), grant access immediately
      if (testSeriesPrice === 0) {
        console.log("Test series is free, granting access immediately");

        await strapi.entityService.update(
          "api::subscription.subscription",
          subscription.id,
          {
            data: {
              is_test_series_purchased: true,
              test_series_purchased_at: new Date(),
            },
          }
        );

        return {
          success: true,
          message: "Test series added successfully (free)",
          subscription_id: subscription.id,
          calculation: {
            testSeriesPrice: 0,
            gstAmount: 0,
            commissionAmount: 0,
            totalAmount: 0,
          },
        };
      }

      // Calculate taxes for paid test series
      const gstRate = await this.getGSTRate();
      const commissionRate = await this.getCommissionRate();

      const gstAmount = (testSeriesPrice * gstRate) / 100;
      const commissionAmount = (testSeriesPrice * commissionRate) / 100;
      const totalAmount = testSeriesPrice + commissionAmount + gstAmount;

      console.log("Price calculation:", {
        testSeriesPrice,
        gstRate,
        gstAmount,
        commissionRate,
        commissionAmount,
        totalAmount,
      });

      // Create Razorpay order
      const orderData = {
        amount: Math.round(totalAmount * 100),
        currency: "INR",
        receipt: `testseries_addon_${enrollment_id}_${Date.now()}`,
        notes: {
          student_id: studentId,
          enrollment_id,
          type: "test_series_only",
          subscription_id: subscription.id,
        },
        payment_capture: 1,
      };

      console.log("Creating Razorpay order:", orderData);

      let order;
      try {
        order = await razorpay.orders.create(orderData);
        console.log("Razorpay order created:", order.id);
      } catch (razorpayError) {
        console.error("Razorpay error:", razorpayError);
        throw new Error(`Razorpay error: ${razorpayError.message}`);
      }

      // Create payment record
      const paymentData = {
        subscription: subscription.id,
        payment_type: "test_series_only",
        amount: totalAmount,
        status: "pending",
        razorpay_order_id: order.id,
        items: {
          classroom: false,
          live_lectures_count: 0,
          test_series: true,
        },
        price_details: {
          classroom_price: 0,
          live_lecture_price: 0,
          test_series_price: testSeriesPrice,
          commission: commissionAmount,
          gst: gstAmount,
          total: totalAmount,
        },
        metadata: {
          purchase_type: "addon",
        },
      };

      console.log("Creating payment:", paymentData);

      const payment = await strapi.entityService.create(
        "api::payment.payment",
        {
          data: paymentData,
        }
      );

      console.log("Payment created:", payment.id);

      return {
        success: true,
        order,
        subscription_id: subscription.id,
        payment_id: payment.id,
        calculation: {
          testSeriesPrice,
          gstAmount,
          commissionAmount,
          totalAmount,
        },
        razorpay_key: process.env.RAZORPAY_KEY_ID,
      };
    } catch (error) {
      console.error("Add test series error:", error);
      return ctx.internalServerError(
        error.message || "Failed to add test series"
      );
    }
  },

  // 4. VERIFY PAYMENT (Universal - works for all payment types)
  async verifyPayment(ctx) {
    try {
      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        payment_id,
      } = ctx.request.body;

      console.log("=== VERIFY PAYMENT ===");
      console.log("Request:", {
        razorpay_order_id,
        razorpay_payment_id,
        payment_id,
      });

      // Verify signature
      const generatedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_SECRET_ID)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest("hex");

      if (generatedSignature !== razorpay_signature) {
        console.error("Signature verification failed");
        return ctx.badRequest("Invalid signature");
      }

      console.log("Signature verified successfully");

      // Get payment record with subscription
      const payment = await strapi.entityService.findOne(
        "api::payment.payment",
        payment_id,
        { populate: ["subscription"] }
      );

      if (!payment) {
        console.error("Payment not found:", payment_id);
        return ctx.badRequest("Payment not found");
      }

      console.log("Payment found:", {
        id: payment.id,
        status: payment.status,
        payment_type: payment.payment_type,
        subscription_id: payment.subscription?.id,
      });

      // Check if payment is already completed
      if (payment.status === "completed") {
        console.log("Payment already completed");
        return {
          success: true,
          payment: payment,
          message: "Payment already verified",
        };
      }

      // Update payment status
      const updatedPayment = await strapi.entityService.update(
        "api::payment.payment",
        payment_id,
        {
          data: {
            status: "completed",
            razorpay_payment_id,
            razorpay_signature,
            completed_at: new Date(),
          },
        }
      );

      console.log("Payment status updated to completed");

      // Update subscription based on payment type
      await this.updateSubscriptionAfterPayment(payment);

      console.log("Payment verification completed successfully");

      return {
        success: true,
        payment: updatedPayment,
        message: "Payment verified successfully",
      };
    } catch (error) {
      console.error("Verify payment error:", error);
      return ctx.internalServerError(
        error.message || "Payment verification failed"
      );
    }
  },

  // 5. HANDLE PAYMENT FAILED (Webhook or frontend callback)
  async handlePaymentFailed(ctx) {
    try {
      const { payment_id } = ctx.request.body;

      console.log("=== HANDLE PAYMENT FAILED ===");
      console.log("Payment ID:", payment_id);

      // Get payment record with subscription
      const payment = await strapi.entityService.findOne(
        "api::payment.payment",
        payment_id,
        { populate: ["subscription"] }
      );

      if (!payment) {
        console.error("Payment not found:", payment_id);
        return ctx.badRequest("Payment not found");
      }

      // Update payment status
      await strapi.entityService.update("api::payment.payment", payment_id, {
        data: {
          status: "failed",
          failed_at: new Date(),
        },
      });

      // Update subscription status to failed
      if (payment.subscription) {
        await strapi.entityService.update(
          "api::subscription.subscription",
          payment.subscription.id,
          {
            data: {
              status: "failed",
            },
          }
        );
      }

      console.log("Payment marked as failed");

      return {
        success: true,
        message: "Payment failed status updated",
      };
    } catch (error) {
      console.error("Handle payment failed error:", error);
      return ctx.internalServerError(
        error.message || "Failed to update payment status"
      );
    }
  },

  // 6. GET SUBSCRIPTION STATUS
  async getSubscriptionStatus(ctx) {
    try {
      const { enrollment_id } = ctx.params;

      console.log("=== GET SUBSCRIPTION STATUS ===");
      console.log("Enrollment ID:", enrollment_id);

      // Get student from token
      const token = ctx.request.header.authorization?.replace("Bearer ", "");
      if (!token) {
        return ctx.unauthorized("Authorization token missing");
      }

      const { id: studentId } = await strapi.plugins[
        "users-permissions"
      ].services.jwt.verify(token);

      console.log("Student ID:", studentId);

      // Get subscription with payments (only active or pending)
      const subscription = await strapi.db
        .query("api::subscription.subscription")
        .findOne({
          where: {
            classroom: enrollment_id,
            student: studentId,
            status: { $in: ["active", "pending"] },
          },
          populate: ["payments", "classroom"],
        });

      if (!subscription) {
        console.log("No subscription found");
        return {
          success: true,
          data: {
            has_subscription: false,
            can_purchase_classroom: true,
            can_add_live_lectures: false,
            can_add_test_series: false,
            message: "No subscription found",
          },
        };
      }

      console.log(
        "Subscription found:",
        subscription.id,
        "Status:",
        subscription.status
      );

      // If subscription is pending, check if there's a completed payment
      if (subscription.status === "pending") {
        const completedPayment = subscription.payments?.find(
          (p) => p.status === "completed"
        );

        if (!completedPayment) {
          console.log("Subscription pending - no completed payment found");
          return {
            success: true,
            data: {
              has_subscription: true,
              subscription_status: "pending",
              subscription: {
                id: subscription.id,
                status: subscription.status,
                is_classroom_purchased: false,
                is_live_lectures_purchased: false,
                is_test_series_purchased: false,
              },
              can_purchase_classroom: false,
              can_add_live_lectures: false,
              can_add_test_series: false,
              message: "Payment pending for subscription",
            },
          };
        }
      }

      // Calculate available lectures for purchase
      const enrollment = subscription.classroom;
      const totalPossibleLectures =
        enrollment.days?.length > 0
          ? countWeekdaysBetweenDates(
              new Date(enrollment.startDate),
              new Date(enrollment.endDate),
              enrollment.days.map((d) => d.days)
            )
          : 0;

      const availableToPurchase = Math.max(
        0,
        totalPossibleLectures - subscription.total_live_lectures_purchased
      );

      console.log("Subscription details:", {
        is_classroom_purchased: subscription.is_classroom_purchased,
        is_live_lectures_purchased: subscription.is_live_lectures_purchased,
        total_live_lectures_purchased:
          subscription.total_live_lectures_purchased,
        is_test_series_purchased: subscription.is_test_series_purchased,
        availableToPurchase,
      });

      return {
        success: true,
        data: {
          has_subscription: true,
          subscription_status: subscription.status,
          subscription: {
            id: subscription.id,
            is_classroom_purchased: subscription.is_classroom_purchased,
            classroom_purchased_at: subscription.classroom_purchased_at,
            is_live_lectures_purchased: subscription.is_live_lectures_purchased,
            live_lectures_purchased_at: subscription.live_lectures_purchased_at,
            total_live_lectures_purchased:
              subscription.total_live_lectures_purchased,
            is_test_series_purchased: subscription.is_test_series_purchased,
            test_series_purchased_at: subscription.test_series_purchased_at,
            status: subscription.status,
            valid_until: subscription.valid_until,
          },
          can_purchase_classroom: false,
          can_add_live_lectures:
            subscription.is_classroom_purchased && availableToPurchase > 0,
          can_add_test_series:
            subscription.is_classroom_purchased &&
            !subscription.is_test_series_purchased,
          available_lectures_count: availableToPurchase,
          total_possible_lectures: totalPossibleLectures,
          payments: subscription.payments,
        },
      };
    } catch (error) {
      console.error("Get subscription status error:", error);
      return ctx.internalServerError(
        error.message || "Failed to get subscription status"
      );
    }
  },

  // 7. GET UPCOMING LIVE LECTURES
  async getUpcomingLiveLectures(ctx) {
    try {
      const { enrollment_id } = ctx.params;

      console.log("=== GET UPCOMING LIVE LECTURES ===");
      console.log("Enrollment ID:", enrollment_id);

      // Get student from token
      const token = ctx.request.header.authorization?.replace("Bearer ", "");
      if (!token) {
        return ctx.unauthorized("Authorization token missing");
      }

      const { id: studentId } = await strapi.plugins[
        "users-permissions"
      ].services.jwt.verify(token);

      console.log("Student ID:", studentId);

      // Get active subscription
      const subscription = await strapi.db
        .query("api::subscription.subscription")
        .findOne({
          where: {
            classroom: enrollment_id,
            student: studentId,
            status: "active",
          },
        });

      // Get enrollment with schedule
      const enrollment = await strapi.entityService.findOne(
        "api::enrollment.enrollment",
        enrollment_id,
        { populate: ["days", "grade_subject"] }
      );

      if (!enrollment) {
        return ctx.badRequest("Enrollment not found");
      }

      // Check if test series is available (free or paid)
      const testSeriesAvailable =
        enrollment.grade_subject?.test_series_price !== null;
      const testSeriesPrice =
        parseFloat(enrollment.grade_subject?.test_series_price) || 0;
      const isTestSeriesFree = testSeriesPrice === 0;

      // Calculate all upcoming classes
      const today = new Date();
      const startDate = new Date(enrollment.startDate);
      const endDate = new Date(enrollment.endDate);
      const weekdays = enrollment.days?.map((day) => day.days) || [];

      let allUpcomingLectures = [];
      if (weekdays.length > 0 && today <= endDate) {
        const effectiveStartDate = today > startDate ? today : startDate;
        const numberOfLectures = countWeekdaysBetweenDates(
          effectiveStartDate,
          endDate,
          weekdays
        );

        console.log("Lectures calculation:", {
          effectiveStartDate,
          endDate,
          weekdays,
          numberOfLectures,
        });

        // Generate lecture objects
        allUpcomingLectures = Array.from(
          { length: numberOfLectures },
          (_, i) => ({
            id: `lecture_${i + 1}`,
            title: `Live Class ${i + 1}`,
            date: this.calculateLectureDate(effectiveStartDate, weekdays, i),
            index: i,
            price: enrollment.lecture_price || 0,
          })
        );
      }

      console.log("All upcoming lectures:", allUpcomingLectures.length);

      // Determine accessible lectures based on subscription
      let accessibleLectures = [];
      let inaccessibleLectures = [];

      if (subscription?.is_live_lectures_purchased) {
        // Student has purchased live lectures
        accessibleLectures = allUpcomingLectures.slice(
          0,
          subscription.total_live_lectures_purchased
        );
        inaccessibleLectures = allUpcomingLectures.slice(
          subscription.total_live_lectures_purchased
        );
      } else {
        // No live lectures purchased
        inaccessibleLectures = allUpcomingLectures;
      }

      console.log("Accessible lectures:", accessibleLectures.length);
      console.log("Inaccessible lectures:", inaccessibleLectures.length);

      return {
        success: true,
        data: {
          accessible_lectures: accessibleLectures,
          inaccessible_lectures: inaccessibleLectures,
          total_upcoming: allUpcomingLectures.length,
          has_live_access: subscription?.is_live_lectures_purchased || false,
          total_purchased: subscription?.total_live_lectures_purchased || 0,
          lecture_price: enrollment.lecture_price || 0,
          test_series_available: testSeriesAvailable,
          test_series_price: testSeriesPrice,
          is_test_series_free: isTestSeriesFree,
          subscription_status: subscription
            ? {
                is_classroom_purchased: subscription.is_classroom_purchased,
                is_live_lectures_purchased:
                  subscription.is_live_lectures_purchased,
                total_live_lectures_purchased:
                  subscription.total_live_lectures_purchased,
                is_test_series_purchased: subscription.is_test_series_purchased,
              }
            : null,
        },
      };
    } catch (error) {
      console.error("Get upcoming lectures error:", error);
      return ctx.internalServerError(
        error.message || "Failed to get upcoming lectures"
      );
    }
  },

  // 8. MARK LIVE LECTURE AS CONSUMED
  async consumeLiveLecture(ctx) {
    try {
      const { subscription_id } = ctx.request.body;

      console.log("=== CONSUME LIVE LECTURE ===");
      console.log("Subscription ID:", subscription_id);

      const subscription = await strapi.entityService.findOne(
        "api::subscription.subscription",
        subscription_id
      );

      if (!subscription) {
        return ctx.badRequest("Subscription not found");
      }

      if (!subscription.is_live_lectures_purchased) {
        return ctx.badRequest("Live lectures not purchased");
      }

      console.log("Lecture consumption recorded");

      return {
        success: true,
        message: "Lecture consumption recorded",
        subscription_id: subscription_id,
      };
    } catch (error) {
      console.error("Consume live lecture error:", error);
      return ctx.internalServerError(
        error.message || "Failed to consume lecture"
      );
    }
  },

  // 9. GET MY SUBSCRIPTIONS
  async getMySubscriptions(ctx) {
    try {
      console.log("=== GET MY SUBSCRIPTIONS ===");

      // Get student from token
      const token = ctx.request.header.authorization?.replace("Bearer ", "");
      if (!token) {
        return ctx.unauthorized("Authorization token missing");
      }

      const { id: studentId } = await strapi.plugins[
        "users-permissions"
      ].services.jwt.verify(token);

      console.log("Student ID:", studentId);

      const subscriptions = await strapi.db
        .query("api::subscription.subscription")
        .findMany({
          where: {
            student: studentId,
            status: { $in: ["active", "pending"] },
          },
          populate: ["classroom", "payments"],
        });

      console.log("Found subscriptions:", subscriptions.length);

      return {
        success: true,
        count: subscriptions.length,
        subscriptions: subscriptions.map((sub) => ({
          id: sub.id,
          classroom: sub.classroom,
          is_classroom_purchased: sub.is_classroom_purchased,
          is_live_lectures_purchased: sub.is_live_lectures_purchased,
          total_live_lectures_purchased: sub.total_live_lectures_purchased,
          is_test_series_purchased: sub.is_test_series_purchased,
          status: sub.status,
          valid_until: sub.valid_until,
          payments_count: sub.payments?.length || 0,
        })),
      };
    } catch (error) {
      console.error("Get my subscriptions error:", error);
      return ctx.internalServerError(
        error.message || "Failed to get subscriptions"
      );
    }
  },

  // ==================== PRIVATE HELPER METHODS ====================

  async updateSubscriptionAfterPayment(payment) {
    const subscriptionId = payment.subscription.id;

    console.log("Updating subscription after payment:", {
      subscriptionId,
      payment_type: payment.payment_type,
      live_lectures_count: payment.items?.live_lectures_count,
      test_series: payment.items?.test_series,
      test_series_price: payment.items?.test_series_price,
    });

    switch (payment.payment_type) {
      case "classroom_only":
        await strapi.entityService.update(
          "api::subscription.subscription",
          subscriptionId,
          {
            data: {
              is_classroom_purchased: true,
              classroom_purchased_at: new Date(),
              status: "active",
            },
          }
        );

        // Enroll student in classroom
        await this.enrollStudentInClassroom(
          payment.subscription.student,
          payment.subscription.classroom
        );

        console.log("Updated subscription for classroom_only");
        break;

      case "classroom_with_live":
        await strapi.entityService.update(
          "api::subscription.subscription",
          subscriptionId,
          {
            data: {
              is_classroom_purchased: true,
              classroom_purchased_at: new Date(),
              is_live_lectures_purchased:
                payment.metadata?.include_live_lectures || false,
              live_lectures_purchased_at: payment.metadata
                ?.include_live_lectures
                ? new Date()
                : null,
              total_live_lectures_purchased:
                payment.items?.live_lectures_count || 0,
              is_test_series_purchased:
                payment.metadata?.include_test_series || false,
              test_series_purchased_at: payment.metadata?.include_test_series
                ? new Date()
                : null,
              status: "active",
            },
          }
        );

        // Enroll student in classroom
        await this.enrollStudentInClassroom(
          payment.subscription.student,
          payment.subscription.classroom
        );

        console.log("Updated subscription for classroom_with_live");
        break;

      case "live_lectures_addon":
        const subscription = await strapi.entityService.findOne(
          "api::subscription.subscription",
          subscriptionId
        );

        const newTotalLectures =
          (subscription.total_live_lectures_purchased || 0) +
          (payment.items?.live_lectures_count || 0);

        await strapi.entityService.update(
          "api::subscription.subscription",
          subscriptionId,
          {
            data: {
              is_live_lectures_purchased: true,
              live_lectures_purchased_at: new Date(),
              total_live_lectures_purchased: newTotalLectures,
            },
          }
        );
        console.log(
          "Updated subscription for live_lectures_addon, new total:",
          newTotalLectures
        );
        break;

      case "test_series_only":
        await strapi.entityService.update(
          "api::subscription.subscription",
          subscriptionId,
          {
            data: {
              is_test_series_purchased: true,
              test_series_purchased_at: new Date(),
            },
          }
        );
        console.log("Updated subscription for test_series_only");
        break;
    }
  },

  async enrollStudentInClassroom(studentId, classroomId) {
    try {
      console.log("Enrolling student in classroom:", {
        studentId,
        classroomId,
      });

      const enrollment = await strapi.entityService.findOne(
        "api::enrollment.enrollment",
        classroomId,
        { populate: ["students"] }
      );

      if (!enrollment) {
        console.error("Enrollment not found:", classroomId);
        return;
      }

      const existingStudentIds = enrollment.students?.map((s) => s.id) || [];

      if (!existingStudentIds.includes(studentId)) {
        await strapi.entityService.update(
          "api::enrollment.enrollment",
          classroomId,
          {
            data: {
              students: {
                connect: [studentId],
              },
            },
          }
        );
        console.log("Student enrolled successfully");
      } else {
        console.log("Student already enrolled");
      }
    } catch (error) {
      console.error("Enroll student error:", error);
    }
  },

  calculateLectureDate(startDate, weekdays, lectureIndex) {
    const dayMap = {
      Sunday: 0,
      Monday: 1,
      Tuesday: 2,
      Wednesday: 3,
      Thursday: 4,
      Friday: 5,
      Saturday: 6,
    };

    const targetDays = weekdays.map((day) => dayMap[day]);
    let currentDate = new Date(startDate);
    let found = 0;

    while (found <= lectureIndex) {
      if (targetDays.includes(currentDate.getDay())) {
        if (found === lectureIndex) {
          return currentDate.toISOString();
        }
        found++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return null;
  },

  async calculateClassroomPrice(
    enrollment,
    includeLiveLectures,
    includeTestSeries
  ) {
    const basePrice = parseFloat(enrollment.base_price) || 0;

    let liveLecturesPrice = 0;
    let numberOfLectures = 0;
    let testSeriesPrice = 0;

    console.log("Calculating price for enrollment:", {
      basePrice,
      includeLiveLectures,
      includeTestSeries,
      lecture_price: enrollment.lecture_price,
      days_count: enrollment.days?.length,
    });

    // Calculate live lectures
    if (includeLiveLectures && enrollment.days?.length > 0) {
      numberOfLectures = countWeekdaysBetweenDates(
        new Date(enrollment.startDate),
        new Date(enrollment.endDate),
        enrollment.days.map((d) => d.days)
      );

      const lecturePrice = parseFloat(enrollment.lecture_price) || 0;
      liveLecturesPrice = numberOfLectures * lecturePrice;

      console.log("Live lectures calculation:", {
        numberOfLectures,
        lecturePrice,
        liveLecturesPrice,
      });
    }

    // Calculate test series
    if (
      includeTestSeries &&
      enrollment.grade_subject?.test_series_price !== null
    ) {
      testSeriesPrice =
        parseFloat(enrollment.grade_subject.test_series_price) || 0;
      console.log("Test series price:", testSeriesPrice);
    }

    // Get tax rates
    const gstRate = await this.getGSTRate();
    const commissionRate = await this.getCommissionRate();

    console.log("Tax rates:", { gstRate, commissionRate });

    // Calculate amounts
    const taxableForCommission = liveLecturesPrice + testSeriesPrice;
    const commissionAmount = (taxableForCommission * commissionRate) / 100;
    const taxableAmount = basePrice + liveLecturesPrice + testSeriesPrice;
    const gstAmount = (taxableAmount * gstRate) / 100;
    const totalAmount =
      basePrice +
      liveLecturesPrice +
      testSeriesPrice +
      commissionAmount +
      gstAmount;

    console.log("Final calculation:", {
      basePrice,
      liveLecturesPrice,
      numberOfLectures,
      testSeriesPrice,
      gstRate,
      gstAmount,
      commissionRate,
      commissionAmount,
      totalAmount,
    });

    return {
      basePrice,
      liveLecturesPrice,
      numberOfLectures,
      testSeriesPrice,
      gstRate,
      gstAmount,
      commissionRate,
      commissionAmount,
      totalAmount,
    };
  },

  // 10. CALCULATE MINIMUM LIVE LECTURES PRICE (minimum 5 lectures)
  async calculateMinimumLiveLecturesPrice(enrollmentId) {
    try {
      const enrollment = await strapi.entityService.findOne(
        "api::enrollment.enrollment",
        enrollmentId,
        { populate: ["days"] }
      );

      if (!enrollment) {
        throw new Error("Enrollment not found");
      }

      const lecturePrice = parseFloat(enrollment.lecture_price) || 0;
      const minimumLectures = 5;
      const liveLecturesPrice = minimumLectures * lecturePrice;

      // Calculate taxes
      const gstRate = await this.getGSTRate();
      const commissionRate = await this.getCommissionRate();

      const gstAmount = (liveLecturesPrice * gstRate) / 100;
      const commissionAmount = (liveLecturesPrice * commissionRate) / 100;
      const totalAmount = liveLecturesPrice + commissionAmount + gstAmount;

      return {
        minimumLectures,
        lecturePrice,
        liveLecturesPrice,
        gstRate,
        gstAmount,
        commissionRate,
        commissionAmount,
        totalAmount,
      };
    } catch (error) {
      console.error("Calculate minimum live lectures price error:", error);
      throw error;
    }
  },
};

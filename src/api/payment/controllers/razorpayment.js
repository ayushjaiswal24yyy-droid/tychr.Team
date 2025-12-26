"use strict";

const Razorpay = require("razorpay");
const crypto = require("crypto");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_SECRET_ID,
});

// Helper function to count weekdays between dates (EXACTLY LIKE FRONTEND)
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

  // Reset time part to compare dates only
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
  // 1. Create classroom order (with or without live lectures)
  async createClassroomOrder(ctx) {
    try {
      console.log("=== CREATE CLASSROOM ORDER START ===");
      const { enrollment_id, include_live_lectures = false } = ctx.request.body;

      console.log("Request body:", ctx.request.body);
      console.log("Enrollment ID:", enrollment_id);
      console.log("Include Live Lectures:", include_live_lectures);

      if (!enrollment_id) {
        console.error("❌ Enrollment ID is required");
        return ctx.badRequest("Enrollment ID is required");
      }

      // Get user from token
      const token = ctx.request.header.authorization?.replace("Bearer ", "");
      if (!token) {
        console.error("❌ Authorization token missing");
        return ctx.unauthorized("Authorization token missing");
      }

      console.log("Token received, verifying...");

      let studentId;
      try {
        const decoded = await strapi.plugins[
          "users-permissions"
        ].services.jwt.verify(token);
        studentId = decoded.id;
        console.log("Student ID from token:", studentId);
      } catch (jwtError) {
        console.error("❌ JWT verification failed:", jwtError);
        return ctx.unauthorized("Invalid token");
      }

      // Fetch enrollment details
      console.log("Fetching enrollment...");
      const enrollment = await strapi.entityService.findOne(
        "api::enrollment.enrollment",
        enrollment_id,
        {
          populate: {
            students: true,
            days: true,
            live_lectures: true,
          },
        }
      );

      if (!enrollment) {
        console.error("❌ Enrollment not found for ID:", enrollment_id);
        return ctx.badRequest("Enrollment not found");
      }

      console.log("Enrollment found:", {
        id: enrollment.id,
        classroom_name: enrollment.classroom_name,
        base_price: enrollment.base_price,
        lecture_price: enrollment.lecture_price,
        startDate: enrollment.startDate,
        endDate: enrollment.endDate,
        days: enrollment.days,
        studentCount: enrollment.students?.length || 0,
      });

      // Check if already enrolled
      const existingStudents = enrollment.students || [];
      if (existingStudents.some((student) => student.id === studentId)) {
        console.error("❌ Student already enrolled");
        return ctx.badRequest("You are already enrolled in this classroom");
      }

      // Calculate price
      console.log("Calculating price...");
      const calculation = await this.calculateClassroomPrice(
        enrollment,
        include_live_lectures,
        studentId
      );

      console.log(
        "Price Calculation Result:",
        JSON.stringify(calculation, null, 2)
      );

      // Validate calculation
      if (
        !calculation ||
        typeof calculation.totalAmount !== "number" ||
        calculation.totalAmount <= 0
      ) {
        console.error("❌ Invalid calculation result:", calculation);
        return ctx.internalServerError("Invalid price calculation");
      }

      // Create Razorpay order
      const orderData = {
        amount: Math.round(calculation.totalAmount * 100),
        currency: "INR",
        receipt: `classroom_${enrollment_id}_${Date.now()}`,
        notes: {
          type: include_live_lectures
            ? "classroom_with_live"
            : "classroom_only",
          enrollment_id,
          student_id: studentId,
        },
        payment_capture: 1,
      };

      console.log("Creating Razorpay order with data:", orderData);

      let order;
      try {
        // Create order
        order = await razorpay.orders.create(orderData);
        console.log("✅ Razorpay order created:", {
          id: order.id,
          amount: order.amount,
          status: order.status,
        });
      } catch (razorpayError) {
        console.error("❌ Razorpay error:", {
          message: razorpayError.message,
          statusCode: razorpayError.statusCode,
          error: razorpayError.error,
        });
        throw new Error(
          `Razorpay error: ${
            razorpayError.error?.description || razorpayError.message
          }`
        );
      }

      // Save pending payment record
      const paymentData = {
        payment_type: include_live_lectures
          ? "classroom_with_live"
          : "classroom_only",
        amount: calculation.totalAmount,
        classroom: enrollment_id,
        student: studentId,
        status: "pending",
        razorpay_order_id: order.id,
        price_at_purchase: calculation.totalAmount,
        commission_percentage_applied: calculation.commissionRate || 0,
        commission_amount: calculation.commissionAmount || 0,
        gst_amount: calculation.gstAmount || 0,
        total_amount_paid: calculation.totalAmount,
        live_lectures_included: include_live_lectures,
        live_lectures_price: calculation.liveLecturesPrice || 0,
        number_of_live_lectures: calculation.numberOfLectures || 0,
        purchased_lectures: calculation.lectures || [],
        metadata: {
          calculation,
          purchase_date: new Date().toISOString(),
          classroom_details: {
            name: enrollment.classroom_name,
            startDate: enrollment.startDate,
            endDate: enrollment.endDate,
            days: enrollment.days,
          },
        },
      };

      console.log(
        "Creating payment record with data:",
        JSON.stringify(paymentData, null, 2)
      );

      let payment;
      try {
        payment = await strapi.entityService.create("api::payment.payment", {
          data: paymentData,
        });
        console.log("✅ Payment record created:", payment.id);
      } catch (dbError) {
        console.error("❌ Database error creating payment:", {
          message: dbError.message,
          details: dbError.details,
        });

        throw dbError;
      }

      return {
        success: true,
        order,
        calculation,
        payment_id: payment.id,
        razorpay_key: process.env.RAZORPAY_KEY_ID,
      };
    } catch (error) {
      console.error("❌ CREATE CLASSROOM ORDER ERROR DETAILS:");
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);

      if (error.details) {
        console.error("Error details:", error.details);
      }

      if (error.message.includes("Razorpay")) {
        return ctx.internalServerError(
          `Payment gateway error: ${error.message}`
        );
      }

      return ctx.internalServerError(error.message || "Failed to create order");
    }
  },

  // 2. Calculate classroom price - UPDATED to match frontend calculation
  async calculateClassroomPrice(enrollment, includeLiveLectures, studentId) {
    try {
      console.log("=== CALCULATE PRICE START ===");
      console.log("Enrollment data received:", {
        startDate: enrollment.startDate,
        endDate: enrollment.endDate,
        days: enrollment.days,
        base_price: enrollment.base_price,
        lecture_price: enrollment.lecture_price,
      });

      const basePrice = parseFloat(enrollment.base_price) || 0;
      console.log("Base price parsed:", basePrice);

      let liveLecturesPrice = 0;
      let numberOfLectures = 0;
      let lectures = [];

      if (
        includeLiveLectures &&
        enrollment.days &&
        enrollment.days.length > 0
      ) {
        // Calculate number of classes based on schedule days between start and end dates
        const startDate = new Date(enrollment.startDate);
        const endDate = new Date(enrollment.endDate);
        const weekdays = enrollment.days.map((day) => day.days);

        console.log("Calculating classes between:", {
          startDate,
          endDate,
          weekdays,
        });

        numberOfLectures = countWeekdaysBetweenDates(
          startDate,
          endDate,
          weekdays
        );
        const lecturePrice = parseFloat(enrollment.lecture_price) || 0;
        liveLecturesPrice = numberOfLectures * lecturePrice;

        console.log("Live lectures calculation:", {
          numberOfLectures,
          lecturePrice,
          liveLecturesPrice,
        });

        // Create lectures array for purchase record
        if (numberOfLectures > 0) {
          lectures = Array.from({ length: numberOfLectures }, (_, i) => ({
            id: `class_${i + 1}`,
            title: `Live Class Session ${i + 1}`,
            date_index: i,
            price: lecturePrice,
          }));
        }
      }

      // Fetch GST data with fallback
      let gstRate = 0;
      try {
        const gstData = await strapi.entityService.findMany("api::gst.gst", {
          filters: { is_active: true },
          limit: 1,
        });
        gstRate = gstData.length > 0 ? parseFloat(gstData[0].gst_rate) : 0;
        console.log("GST Rate:", gstRate);
      } catch (gstError) {
        console.warn("⚠️ Could not fetch GST, using 0:", gstError.message);
      }

      // Fetch commission data with fallback - ONLY FOR LIVE LECTURES
      let commissionRate = 0;
      let commissionAmount = 0;

      if (liveLecturesPrice > 0) {
        try {
          const commissionData = await strapi.entityService.findMany(
            "api::commission-setting.commission-setting",
            {
              filters: {
                system_plan: "classroom",
                is_active: true,
              },
              sort: { effective_from: "desc" },
              limit: 1,
            }
          );
          commissionRate =
            commissionData.length > 0
              ? parseFloat(commissionData[0].commission_percentage)
              : 0;
          commissionAmount = parseFloat(
            ((liveLecturesPrice * commissionRate) / 100).toFixed(2)
          );
          console.log(
            "Commission Rate:",
            commissionRate,
            "Amount:",
            commissionAmount
          );
        } catch (commissionError) {
          console.warn(
            "⚠️ Could not fetch commission, using 0:",
            commissionError.message
          );
        }
      }

      // Calculate amounts with proper rounding
      const taxableAmount = basePrice + liveLecturesPrice;
      const gstAmount = parseFloat(
        ((taxableAmount * gstRate) / 100).toFixed(2)
      );
      const totalAmount = parseFloat(
        (basePrice + liveLecturesPrice + commissionAmount + gstAmount).toFixed(
          2
        )
      );

      console.log("Final calculation:", {
        basePrice,
        liveLecturesPrice,
        numberOfLectures,
        taxableAmount,
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
        lectures,
        gstRate,
        gstAmount,
        commissionRate,
        commissionAmount,
        totalAmount,
        includeLiveLectures,
      };
    } catch (error) {
      console.error("❌ CALCULATE PRICE ERROR:", error);
      throw error;
    }
  },

  // 3. Calculate remaining live lectures for existing students
  async calculateRemainingLiveLectures(enrollmentId, studentId) {
    try {
      console.log("=== CALCULATE REMAINING LIVE LECTURES ===");

      const enrollment = await strapi.entityService.findOne(
        "api::enrollment.enrollment",
        enrollmentId,
        {
          populate: ["days"],
        }
      );

      if (!enrollment) {
        throw new Error("Enrollment not found");
      }

      console.log("Enrollment for remaining lectures:", {
        startDate: enrollment.startDate,
        endDate: enrollment.endDate,
        days: enrollment.days,
        lecture_price: enrollment.lecture_price,
      });

      const today = new Date();
      const startDate = new Date(enrollment.startDate);
      const endDate = new Date(enrollment.endDate);
      const weekdays = enrollment.days?.map((day) => day.days) || [];

      // Calculate total number of classes from today till end date
      let numberOfLectures = 0;
      if (weekdays.length > 0 && today <= endDate) {
        // Use today as start date if classroom has already started
        const effectiveStartDate = today > startDate ? today : startDate;
        numberOfLectures = countWeekdaysBetweenDates(
          effectiveStartDate,
          endDate,
          weekdays
        );
      }

      const lecturePrice = parseFloat(enrollment.lecture_price) || 0;
      const liveLecturesPrice = numberOfLectures * lecturePrice;

      // Check if student already purchased any lectures
      const existingPurchase = await strapi.db
        .query("api::live-lecture-purchase.live-lecture-purchase")
        .findOne({
          where: {
            enrollment: enrollmentId,
            student: studentId,
            is_active: true,
          },
        });

      // If student already has purchase, they can't buy again (since it's all-or-nothing)
      if (existingPurchase) {
        console.log("Student already has live lecture access");
        return {
          liveLecturesPrice: 0,
          numberOfLectures: 0,
          lectures: [],
          gstRate: 0,
          gstAmount: 0,
          commissionRate: 0,
          commissionAmount: 0,
          totalAmount: 0,
        };
      }

      // Fetch GST data
      let gstRate = 0;
      try {
        const gstData = await strapi.entityService.findMany("api::gst.gst", {
          filters: { is_active: true },
          limit: 1,
        });
        gstRate = gstData.length > 0 ? parseFloat(gstData[0].gst_rate) : 0;
      } catch (gstError) {
        console.warn("⚠️ Could not fetch GST, using 0:", gstError.message);
      }

      // Fetch commission data for live lectures
      let commissionRate = 0;
      let commissionAmount = 0;

      if (liveLecturesPrice > 0) {
        try {
          const commissionData = await strapi.entityService.findMany(
            "api::commission-setting.commission-setting",
            {
              filters: {
                system_plan: "classroom",
                is_active: true,
              },
              sort: { effective_from: "desc" },
              limit: 1,
            }
          );
          commissionRate =
            commissionData.length > 0
              ? parseFloat(commissionData[0].commission_percentage)
              : 0;
          commissionAmount = parseFloat(
            ((liveLecturesPrice * commissionRate) / 100).toFixed(2)
          );
        } catch (commissionError) {
          console.warn(
            "⚠️ Could not fetch commission:",
            commissionError.message
          );
        }
      }

      // Calculate amounts
      const gstAmount = parseFloat(
        ((liveLecturesPrice * gstRate) / 100).toFixed(2)
      );
      const totalAmount = parseFloat(
        (liveLecturesPrice + commissionAmount + gstAmount).toFixed(2)
      );

      // Create lectures array
      const lectures =
        numberOfLectures > 0
          ? Array.from({ length: numberOfLectures }, (_, i) => ({
              id: `remaining_class_${i + 1}`,
              title: `Live Class Session ${i + 1}`,
              date_index: i,
              price: lecturePrice,
            }))
          : [];

      console.log("Remaining lectures calculation:", {
        numberOfLectures,
        lecturePrice,
        liveLecturesPrice,
        gstRate,
        gstAmount,
        commissionRate,
        commissionAmount,
        totalAmount,
      });

      return {
        liveLecturesPrice,
        numberOfLectures,
        lectures,
        gstRate,
        gstAmount,
        commissionRate,
        commissionAmount,
        totalAmount,
      };
    } catch (error) {
      console.error("❌ CALCULATE REMAINING LECTURES ERROR:", error);
      throw error;
    }
  },

  // 4. Create live lectures only order (after classroom purchase)
  async createLiveLecturesOrder(ctx) {
    try {
      console.log("=== CREATE LIVE LECTURES ORDER ===");
      const { enrollment_id } = ctx.request.body;

      console.log("Enrollment ID:", enrollment_id);

      if (!enrollment_id) {
        return ctx.badRequest("Enrollment ID is required");
      }

      // Get user from token
      const token = ctx.request.header.authorization?.replace("Bearer ", "");
      if (!token) {
        return ctx.unauthorized("Authorization token missing");
      }

      const { id: studentId } = await strapi.plugins[
        "users-permissions"
      ].services.jwt.verify(token);

      console.log("Student ID:", studentId);

      // Check if student has classroom access
      const hasClassroomAccess = await this.checkClassroomAccess(
        enrollment_id,
        studentId
      );
      if (!hasClassroomAccess) {
        console.error("❌ Student doesn't have classroom access");
        return ctx.badRequest("You must enroll in the classroom first");
      }

      // Check if already has live lecture access
      const hasLiveAccess = await this.checkLiveLectureAccess(
        enrollment_id,
        studentId
      );
      if (hasLiveAccess) {
        console.error("❌ Student already has live lecture access");
        return ctx.badRequest("You already have live lecture access");
      }

      // Calculate price for remaining live lectures
      const calculation = await this.calculateRemainingLiveLectures(
        enrollment_id,
        studentId
      );

      console.log("Live Lectures Calculation:", calculation);

      if (calculation.numberOfLectures === 0 || calculation.totalAmount === 0) {
        return ctx.badRequest(
          "No upcoming live lectures available for purchase"
        );
      }

      // Create Razorpay order
      const orderData = {
        amount: Math.round(calculation.totalAmount * 100),
        currency: "INR",
        receipt: `live_${enrollment_id}_${Date.now()}`,
        notes: {
          type: "live_only",
          enrollment_id,
          student_id: studentId,
        },
        payment_capture: 1,
      };

      console.log("Live Order data to Razorpay:", orderData);

      const order = await razorpay.orders.create(orderData);

      console.log("✅ Live lectures order created:", order.id);

      // Save pending payment record
      const paymentData = {
        payment_type: "live_only",
        amount: calculation.totalAmount,
        classroom: enrollment_id,
        student: studentId,
        status: "pending",
        razorpay_order_id: order.id,
        price_at_purchase: calculation.totalAmount,
        commission_percentage_applied: calculation.commissionRate,
        commission_amount: calculation.commissionAmount,
        gst_amount: calculation.gstAmount,
        total_amount_paid: calculation.totalAmount,
        live_lectures_included: true,
        live_lectures_price: calculation.liveLecturesPrice,
        number_of_live_lectures: calculation.numberOfLectures,
        purchased_lectures: calculation.lectures,
        metadata: {
          calculation,
          purchase_date: new Date().toISOString(),
          purchase_type: "live_only_addon",
        },
      };

      const payment = await strapi.entityService.create(
        "api::payment.payment",
        {
          data: paymentData,
        }
      );

      console.log("✅ Live payment record created:", payment.id);

      return {
        success: true,
        order,
        calculation,
        payment_id: payment.id,
      };
    } catch (error) {
      console.error("❌ CREATE LIVE LECTURES ORDER ERROR:", error);
      return ctx.internalServerError(error.message || "Failed to create order");
    }
  },

  // 5. Verify payment (common for both)
  async verifyPayment(ctx) {
    try {
      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        payment_type = "classroom_only",
      } = ctx.request.body;

      console.log("=== VERIFY PAYMENT ===");
      console.log("Payment ID:", razorpay_payment_id);
      console.log("Order ID:", razorpay_order_id);
      console.log("Payment Type:", payment_type);

      // Verify signature
      const generatedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_SECRET_ID)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest("hex");

      console.log("Generated signature:", generatedSignature);
      console.log("Received signature:", razorpay_signature);

      if (generatedSignature !== razorpay_signature) {
        console.error("❌ Signature verification failed");
        return ctx.badRequest("Payment verification failed");
      }

      // Get payment record
      const payment = await strapi.db.query("api::payment.payment").findOne({
        where: { razorpay_order_id },
        populate: ["classroom", "student"],
      });

      if (!payment) {
        console.error(
          "❌ Payment record not found for order:",
          razorpay_order_id
        );
        return ctx.badRequest("Payment record not found");
      }

      console.log("Payment record found:", payment.id);

      // Update payment status
      const updatedPayment = await strapi.entityService.update(
        "api::payment.payment",
        payment.id,
        {
          data: {
            status: "completed",
            razorpay_payment_id,
            razorpay_signature,
            purchased_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
          },
        }
      );

      console.log("✅ Payment status updated to completed");

      // Handle based on payment type
      if (
        payment_type === "classroom_only" ||
        payment_type === "classroom_with_live"
      ) {
        // Enroll student in classroom
        await strapi.entityService.update(
          "api::enrollment.enrollment",
          payment.classroom.id,
          {
            data: {
              students: {
                connect: [payment.student.id],
              },
            },
          }
        );

        console.log(
          `✅ Student ${payment.student.id} enrolled in classroom ${payment.classroom.id}`
        );

        // If live lectures included, grant access
        if (
          payment_type === "classroom_with_live" &&
          payment.live_lectures_included
        ) {
          console.log(
            "✅ Granting live lecture access with classroom purchase"
          );
          await this.grantLiveLectureAccess(payment, payment_type);
        }
      } else if (payment_type === "live_only") {
        // Grant access to live lectures
        console.log("✅ Granting live-only lecture access");
        await this.grantLiveLectureAccess(payment, payment_type);
      }

      console.log("✅ Payment verified and processed successfully");

      return {
        success: true,
        payment: updatedPayment,
        message: "Payment verified successfully",
      };
    } catch (error) {
      console.error("❌ PAYMENT VERIFICATION ERROR:", error);
      console.error(error.stack);
      return ctx.internalServerError("Payment verification failed");
    }
  },

  // 6. Grant live lecture access
  async grantLiveLectureAccess(payment, payment_type = "classroom_with_live") {
    try {
      console.log("=== GRANT LIVE LECTURE ACCESS ===");
      console.log("Payment ID:", payment.id);
      console.log("Payment type:", payment_type);

      // Get enrollment details to understand the schedule
      const enrollment = await strapi.entityService.findOne(
        "api::enrollment.enrollment",
        payment.classroom.id,
        {
          populate: ["days"],
        }
      );

      if (!enrollment) {
        throw new Error("Enrollment not found");
      }

      // Check if live lecture purchase already exists
      const existingPurchase = await strapi.db
        .query("api::live-lecture-purchase.live-lecture-purchase")
        .findOne({
          where: {
            enrollment: payment.classroom.id,
            student: payment.student.id,
            is_active: true,
          },
        });

      if (existingPurchase) {
        console.log("⚠️ Live lecture purchase already exists, updating...");

        // Update existing purchase
        const updatedPurchase = await strapi.entityService.update(
          "api::live-lecture-purchase.live-lecture-purchase",
          existingPurchase.id,
          {
            data: {
              lectures_purchased: payment.purchased_lectures || [],
              valid_until: new Date(
                new Date().setFullYear(new Date().getFullYear() + 1)
              ).toISOString(),
              is_active: true,
              payment: payment.id,
            },
          }
        );

        console.log(
          "✅ Existing live lecture purchase updated:",
          updatedPurchase.id
        );
        return updatedPurchase;
      }

      // Create new live lecture purchase record
      const livePurchaseData = {
        enrollment: payment.classroom.id,
        student: payment.student.id,
        payment: payment.id,
        lectures_purchased: payment.purchased_lectures || [],
        purchase_date: new Date().toISOString(),
        valid_from: new Date().toISOString(),
        valid_until: new Date(
          new Date().setFullYear(new Date().getFullYear() + 1)
        ).toISOString(),
        is_active: true,
      };

      console.log("Creating live lecture purchase:", livePurchaseData);

      const livePurchase = await strapi.entityService.create(
        "api::live-lecture-purchase.live-lecture-purchase",
        {
          data: livePurchaseData,
        }
      );

      console.log(
        `✅ Live lecture access granted for student ${payment.student.id}`,
        livePurchase.id
      );
      return livePurchase;
    } catch (error) {
      console.error("❌ GRANT LIVE LECTURE ACCESS ERROR:", error);
      throw error;
    }
  },

  // 7. Check student's access status
  async checkAccessStatus(ctx) {
    try {
      const { enrollment_id } = ctx.params;

      console.log("=== CHECK ACCESS STATUS ===");
      console.log("Enrollment ID:", enrollment_id);

      // Get user from token
      const token = ctx.request.header.authorization?.replace("Bearer ", "");
      if (!token) {
        return ctx.unauthorized("Authorization token missing");
      }

      const { id: studentId } = await strapi.plugins[
        "users-permissions"
      ].services.jwt.verify(token);

      console.log("Student ID:", studentId);

      // Check classroom access
      const enrollment = await strapi.entityService.findOne(
        "api::enrollment.enrollment",
        enrollment_id,
        {
          populate: ["students"],
        }
      );

      const classroomAccess =
        enrollment?.students?.some((student) => student.id === studentId) ||
        false;

      console.log("Classroom access:", classroomAccess);

      // Check live lecture access
      const liveLecturePurchase = await strapi.db
        .query("api::live-lecture-purchase.live-lecture-purchase")
        .findOne({
          where: {
            enrollment: enrollment_id,
            student: studentId,
            is_active: true,
          },
        });

      const liveLectureAccess = !!liveLecturePurchase;
      console.log("Live lecture access:", liveLectureAccess);

      // Check if can purchase live lectures
      let canPurchaseLive = false;
      let remainingLectures = null;

      if (classroomAccess && !liveLectureAccess) {
        remainingLectures = await this.calculateRemainingLiveLectures(
          enrollment_id,
          studentId
        );
        canPurchaseLive =
          remainingLectures.numberOfLectures > 0 &&
          remainingLectures.totalAmount > 0;
        console.log(
          "Can purchase live:",
          canPurchaseLive,
          "Remaining:",
          remainingLectures.numberOfLectures
        );
      }

      return {
        success: true,
        data: {
          classroom_access: classroomAccess,
          live_lecture_access: liveLectureAccess,
          live_lectures: liveLecturePurchase?.lectures_purchased || [],
          can_purchase_live: canPurchaseLive,
          student_id: studentId,
          enrollment_id: enrollment_id,
          remaining_lectures_info: remainingLectures,
        },
      };
    } catch (error) {
      console.error("Check access status error:", error);
      return ctx.internalServerError(error.message);
    }
  },

  // 8. Helper: Check classroom access
  async checkClassroomAccess(enrollmentId, studentId) {
    try {
      const enrollment = await strapi.entityService.findOne(
        "api::enrollment.enrollment",
        enrollmentId,
        {
          populate: ["students"],
        }
      );

      return (
        enrollment?.students?.some((student) => student.id === studentId) ||
        false
      );
    } catch (error) {
      console.error("Check classroom access error:", error);
      return false;
    }
  },

  // 9. Helper: Check live lecture access
  async checkLiveLectureAccess(enrollmentId, studentId) {
    try {
      const livePurchase = await strapi.db
        .query("api::live-lecture-purchase.live-lecture-purchase")
        .findOne({
          where: {
            enrollment: enrollmentId,
            student: studentId,
            is_active: true,
          },
        });

      return !!livePurchase;
    } catch (error) {
      console.error("Check live lecture access error:", error);
      return false;
    }
  },

  // 10. Get upcoming live lectures for student (based on schedule)
  async getUpcomingLiveLectures(ctx) {
    try {
      const { enrollment_id } = ctx.params;

      console.log("=== GET UPCOMING LIVE LECTURES ===");
      console.log("Enrollment ID:", enrollment_id);

      // Get user from token
      const token = ctx.request.header.authorization?.replace("Bearer ", "");
      if (!token) {
        return ctx.unauthorized("Authorization token missing");
      }

      const { id: studentId } = await strapi.plugins[
        "users-permissions"
      ].services.jwt.verify(token);

      // Check classroom access first
      const hasClassroomAccess = await this.checkClassroomAccess(
        enrollment_id,
        studentId
      );
      if (!hasClassroomAccess) {
        return ctx.badRequest("You must enroll in the classroom first");
      }

      // Get enrollment with schedule
      const enrollment = await strapi.entityService.findOne(
        "api::enrollment.enrollment",
        enrollment_id,
        {
          populate: ["days"],
        }
      );

      if (!enrollment) {
        return ctx.badRequest("Enrollment not found");
      }

      const today = new Date();
      const startDate = new Date(enrollment.startDate);
      const endDate = new Date(enrollment.endDate);
      const weekdays = enrollment.days?.map((day) => day.days) || [];

      // Calculate all upcoming classes
      let allUpcomingLectures = [];
      if (weekdays.length > 0 && today <= endDate) {
        const effectiveStartDate = today > startDate ? today : startDate;
        const numberOfLectures = countWeekdaysBetweenDates(
          effectiveStartDate,
          endDate,
          weekdays
        );

        // Generate lecture objects
        allUpcomingLectures = Array.from(
          { length: numberOfLectures },
          (_, i) => ({
            id: `scheduled_class_${i + 1}`,
            title: `Live Class Session ${i + 1}`,
            scheduled_at: this.calculateNextClassDate(
              effectiveStartDate,
              weekdays,
              i
            ),
            price: parseFloat(enrollment.lecture_price) || 0,
            is_scheduled: true,
          })
        );
      }

      // Get purchased lecture IDs from purchase record
      const livePurchase = await strapi.db
        .query("api::live-lecture-purchase.live-lecture-purchase")
        .findOne({
          where: {
            enrollment: enrollment_id,
            student: studentId,
            is_active: true,
          },
        });

      // If student has live access, all lectures are purchased
      const hasLiveAccess = !!livePurchase;

      return {
        success: true,
        data: {
          purchased_lectures: hasLiveAccess ? allUpcomingLectures : [],
          available_lectures: hasLiveAccess ? [] : allUpcomingLectures,
          total_upcoming: allUpcomingLectures.length,
          has_live_access: hasLiveAccess,
          lecture_price: enrollment.lecture_price || 0,
          schedule: {
            startDate: enrollment.startDate,
            endDate: enrollment.endDate,
            days: weekdays,
          },
        },
      };
    } catch (error) {
      console.error("Get upcoming lectures error:", error);
      return ctx.internalServerError(error.message);
    }
  },

  // 11. Helper: Calculate next class date based on schedule
  calculateNextClassDate(startDate, weekdays, classIndex) {
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
    let classesFound = 0;
    let resultDate = null;

    while (classesFound <= classIndex) {
      if (targetDays.includes(currentDate.getDay())) {
        if (classesFound === classIndex) {
          resultDate = new Date(currentDate);
          break;
        }
        classesFound++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return resultDate ? resultDate.toISOString() : null;
  },

  // 12. Simple test endpoint
  async testPayment(ctx) {
    try {
      console.log("=== TEST PAYMENT ENDPOINT ===");

      // Check environment variables
      const envVars = {
        RAZORPAY_KEY_ID: !!process.env.RAZORPAY_KEY_ID,
        RAZORPAY_SECRET_ID: !!process.env.RAZORPAY_SECRET_ID,
      };

      console.log("Environment variables:", envVars);

      // Test database connection
      const testPayment = await strapi.entityService.findMany(
        "api::payment.payment",
        {
          limit: 1,
        }
      );

      console.log("Database connection:", testPayment ? "OK" : "Failed");

      // Test Razorpay connection
      let razorpayStatus = "Unknown";
      try {
        await razorpay.orders.all({ count: 1 });
        razorpayStatus = "OK";
      } catch (razorpayError) {
        razorpayStatus = `Failed: ${razorpayError.message}`;
      }

      return {
        success: true,
        timestamp: new Date().toISOString(),
        environment: envVars,
        database: "Connected",
        razorpay: razorpayStatus,
        message: "Payment service is running",
      };
    } catch (error) {
      console.error("Test endpoint error:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  },
};

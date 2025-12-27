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
  // 1. Create classroom order (with or without live lectures and test series)
  async createClassroomOrder(ctx) {
    try {
      console.log("=== CREATE CLASSROOM ORDER START ===");
      const {
        enrollment_id,
        include_live_lectures = false,
        include_test_series = false,
      } = ctx.request.body;

      console.log("Request body:", ctx.request.body);
      console.log("Enrollment ID:", enrollment_id);
      console.log("Include Live Lectures:", include_live_lectures);
      console.log("Include Test Series:", include_test_series);

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

      // Fetch enrollment details with grade_subject
      console.log("Fetching enrollment...");
      const enrollment = await strapi.entityService.findOne(
        "api::enrollment.enrollment",
        enrollment_id,
        {
          populate: {
            students: true,
            days: true,
            live_lectures: true,
            grade_subject: {
              fields: ["test_series_price", "name"],
            },
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
        grade_subject: enrollment.grade_subject,
        studentCount: enrollment.students?.length || 0,
      });

      // Check if already enrolled
      const existingStudents = enrollment.students || [];
      if (existingStudents.some((student) => student.id === studentId)) {
        console.error("❌ Student already enrolled");
        return ctx.badRequest("You are already enrolled in this classroom");
      }

      // Calculate price with test series option
      console.log("Calculating price...");
      const calculation = await this.calculateClassroomPrice(
        enrollment,
        include_live_lectures,
        include_test_series,
        studentId
      );

      console.log(
        "Price Calculation Result:",
        JSON.stringify(calculation, null, 2)
      );

      // Validate calculation
      if (!calculation || typeof calculation.totalAmount !== "number") {
        console.error("❌ Invalid calculation result:", calculation);
        return ctx.internalServerError("Invalid price calculation");
      }

      if (calculation.totalAmount <= 0) {
        return ctx.badRequest("Total amount must be greater than 0");
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
          include_test_series: include_test_series,
        },
        payment_capture: 1,
      };

      console.log("Creating Razorpay order with data:", orderData);

      let order;
      try {
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
        test_series_included: include_test_series,
        test_series_price: calculation.testSeriesPrice || 0,
        purchased_lectures: calculation.lectures || [],
        metadata: {
          calculation,
          purchase_date: new Date().toISOString(),
          classroom_details: {
            name: enrollment.classroom_name,
            startDate: enrollment.startDate,
            endDate: enrollment.endDate,
            days: enrollment.days,
            grade_subject: enrollment.grade_subject,
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

  // 2. Calculate classroom price - UPDATED to include test series
  async calculateClassroomPrice(
    enrollment,
    includeLiveLectures,
    includeTestSeries,
    studentId
  ) {
    try {
      console.log("=== CALCULATE PRICE START ===");
      console.log("Include Test Series:", includeTestSeries);

      const basePrice = parseFloat(enrollment.base_price) || 0;
      console.log("Base price parsed:", basePrice);

      let liveLecturesPrice = 0;
      let numberOfLectures = 0;
      let lectures = [];
      let testSeriesPrice = 0;

      // Calculate live lectures price
      if (
        includeLiveLectures &&
        enrollment.days &&
        enrollment.days.length > 0
      ) {
        const startDate = new Date(enrollment.startDate);
        const endDate = new Date(enrollment.endDate);
        const weekdays = enrollment.days.map((day) => day.days);

        console.log("Calculating live lectures:", {
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

      // Calculate test series price if included
      if (includeTestSeries && enrollment.grade_subject) {
        try {
          // Get test_series_price from grade_subject
          const gradeSubject = await strapi.entityService.findOne(
            "api::grade-subject.grade-subject",
            enrollment.grade_subject.id,
            {
              fields: ["test_series_price", "name"],
            }
          );

          testSeriesPrice = parseFloat(gradeSubject?.test_series_price) || 0;
          console.log("Test Series Price from grade subject:", testSeriesPrice);
        } catch (error) {
          console.warn("⚠️ Could not fetch test series price:", error.message);
          testSeriesPrice = 0;
        }
      }

      // Fetch GST data
      let gstRate = 0;
      try {
        const gstData = await strapi.entityService.findOne("api::gst.gst", {
          filters: { is_active: true },
        });
        gstRate = gstData ? parseFloat(gstData.gst_rate) : 0;
        console.log("GST Rate:", gstRate);
      } catch (gstError) {
        console.warn("⚠️ Could not fetch GST, using 0:", gstError.message);
        gstRate = 0;
      }

      // Fetch commission data - FOR LIVE LECTURES AND TEST SERIES
      let commissionRate = 0;
      let commissionAmount = 0;

      const taxableForCommission = liveLecturesPrice + testSeriesPrice;
      if (taxableForCommission > 0) {
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
            ((taxableForCommission * commissionRate) / 100).toFixed(2)
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
      const taxableAmount = basePrice + liveLecturesPrice + testSeriesPrice;
      const gstAmount = parseFloat(
        ((taxableAmount * gstRate) / 100).toFixed(2)
      );
      const totalAmount = parseFloat(
        (
          basePrice +
          liveLecturesPrice +
          testSeriesPrice +
          commissionAmount +
          gstAmount
        ).toFixed(2)
      );

      console.log("Final calculation:", {
        basePrice,
        liveLecturesPrice,
        numberOfLectures,
        testSeriesPrice,
        taxableAmount,
        gstRate,
        gstAmount,
        commissionRate,
        commissionAmount,
        totalAmount,
        includeTestSeries,
      });

      return {
        basePrice,
        liveLecturesPrice,
        testSeriesPrice,
        numberOfLectures,
        lectures,
        gstRate,
        gstAmount,
        commissionRate,
        commissionAmount,
        totalAmount,
        includeLiveLectures,
        includeTestSeries,
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

      const today = new Date();
      const startDate = new Date(enrollment.startDate);
      const endDate = new Date(enrollment.endDate);
      const weekdays = enrollment.days?.map((day) => day.days) || [];

      // Calculate total number of classes from today till end date
      let numberOfLectures = 0;
      if (weekdays.length > 0 && today <= endDate) {
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

      // If student already has purchase, they can't buy again
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

  // 5. Create test series only order (after classroom purchase)
  async createTestSeriesOrder(ctx) {
    try {
      console.log("=== CREATE TEST SERIES ORDER ===");
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

      // Check if already has test series access
      const hasTestSeriesAccess = await this.checkTestSeriesAccess(
        enrollment_id,
        studentId
      );
      if (hasTestSeriesAccess) {
        console.error("❌ Student already has test series access");
        return ctx.badRequest("You already have test series access");
      }

      // Calculate price for test series
      const calculation = await this.calculateTestSeriesOnlyPrice(
        enrollment_id,
        studentId
      );

      console.log("Test Series Calculation:", calculation);

      if (calculation.totalAmount === 0) {
        return ctx.badRequest("Test series is not available or free");
      }

      // Create Razorpay order
      const orderData = {
        amount: Math.round(calculation.totalAmount * 100),
        currency: "INR",
        receipt: `testseries_${enrollment_id}_${Date.now()}`,
        notes: {
          type: "test_series_only",
          enrollment_id,
          student_id: studentId,
        },
        payment_capture: 1,
      };

      console.log("Test Series Order data to Razorpay:", orderData);

      const order = await razorpay.orders.create(orderData);

      console.log("✅ Test series order created:", order.id);

      // Save pending payment record
      const paymentData = {
        payment_type: "test_series_only",
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
        test_series_included: true,
        test_series_price: calculation.testSeriesPrice,
        metadata: {
          calculation,
          purchase_date: new Date().toISOString(),
          purchase_type: "test_series_only_addon",
        },
      };

      const payment = await strapi.entityService.create(
        "api::payment.payment",
        {
          data: paymentData,
        }
      );

      console.log("✅ Test series payment record created:", payment.id);

      return {
        success: true,
        order,
        calculation,
        payment_id: payment.id,
      };
    } catch (error) {
      console.error("❌ CREATE TEST SERIES ORDER ERROR:", error);
      return ctx.internalServerError(error.message || "Failed to create order");
    }
  },

  // 6. Calculate test series only price
  async calculateTestSeriesOnlyPrice(enrollmentId, studentId) {
    try {
      console.log("=== CALCULATE TEST SERIES ONLY PRICE ===");

      const enrollment = await strapi.entityService.findOne(
        "api::enrollment.enrollment",
        enrollmentId,
        {
          populate: ["grade_subject"],
        }
      );

      if (!enrollment || !enrollment.grade_subject) {
        throw new Error("Enrollment or grade subject not found");
      }

      // Get test series price from grade_subject
      const gradeSubject = await strapi.entityService.findOne(
        "api::grade-subject.grade-subject",
        enrollment.grade_subject.id,
        {
          fields: ["test_series_price"],
        }
      );

      const testSeriesPrice = parseFloat(gradeSubject?.test_series_price) || 0;

      if (testSeriesPrice <= 0) {
        return {
          testSeriesPrice: 0,
          gstRate: 0,
          gstAmount: 0,
          commissionRate: 0,
          commissionAmount: 0,
          totalAmount: 0,
        };
      }

      // Fetch GST
      let gstRate = 0;
      try {
        const gstData = await strapi.entityService.findOne("api::gst.gst", {
          filters: { is_active: true },
        });
        gstRate = gstData ? parseFloat(gstData.gst_rate) : 0;
      } catch (gstError) {
        console.warn("⚠️ Could not fetch GST:", gstError.message);
      }

      // Fetch commission for test series
      let commissionRate = 0;
      let commissionAmount = 0;

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
          ((testSeriesPrice * commissionRate) / 100).toFixed(2)
        );
      } catch (commissionError) {
        console.warn("⚠️ Could not fetch commission:", commissionError.message);
      }

      // Calculate amounts
      const gstAmount = parseFloat(
        ((testSeriesPrice * gstRate) / 100).toFixed(2)
      );
      const totalAmount = parseFloat(
        (testSeriesPrice + commissionAmount + gstAmount).toFixed(2)
      );

      console.log("Test series calculation:", {
        testSeriesPrice,
        gstRate,
        gstAmount,
        commissionRate,
        commissionAmount,
        totalAmount,
      });

      return {
        testSeriesPrice,
        gstRate,
        gstAmount,
        commissionRate,
        commissionAmount,
        totalAmount,
      };
    } catch (error) {
      console.error("❌ CALCULATE TEST SERIES PRICE ERROR:", error);
      throw error;
    }
  },

  // 7. Verify payment (common for all types)
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

      if (generatedSignature !== razorpay_signature) {
        console.error("❌ Signature verification failed");
        return ctx.badRequest(
          "Payment verification failed - Invalid signature"
        );
      }

      console.log("✅ Signature verification successful");

      // Get payment record
      const payment = await strapi.db.query("api::payment.payment").findOne({
        where: { razorpay_order_id: razorpay_order_id },
        populate: {
          classroom: true,
          student: true,
        },
      });

      if (!payment) {
        console.error(
          "❌ Payment record not found for order:",
          razorpay_order_id
        );
        return ctx.badRequest("Payment record not found");
      }

      console.log("✅ Payment record found:", {
        id: payment.id,
        student_id: payment.student?.id,
        classroom_id: payment.classroom?.id,
        status: payment.status,
        payment_type: payment.payment_type,
        live_lectures_included: payment.live_lectures_included,
        test_series_included: payment.test_series_included,
      });

      // Check if payment is already completed
      if (payment.status === "completed") {
        console.log("⚠️ Payment already completed, returning success");
        return {
          success: true,
          payment: payment,
          message: "Payment already verified",
        };
      }

      // Update payment status
      const updatedPayment = await strapi.entityService.update(
        "api::payment.payment",
        payment.id,
        {
          data: {
            status: "completed",
            razorpay_payment_id,
            razorpay_signature,
            purchased_at: new Date(),
            completed_at: new Date(),
          },
        }
      );

      console.log("✅ Payment status updated to completed");

      // Handle based on payment type
      if (
        payment_type === "classroom_only" ||
        payment_type === "classroom_with_live"
      ) {
        try {
          // Enroll student in classroom
          const enrollmentId = payment.classroom?.id || payment.classroom;

          if (!enrollmentId) {
            console.error("❌ Enrollment ID not found in payment");
            throw new Error("Enrollment ID not found");
          }

          // Get current enrollment
          const enrollment = await strapi.entityService.findOne(
            "api::enrollment.enrollment",
            enrollmentId,
            {
              populate: ["students"],
            }
          );

          if (!enrollment) {
            console.error("❌ Enrollment not found:", enrollmentId);
            throw new Error("Enrollment not found");
          }

          const studentId = payment.student?.id || payment.student;
          const existingStudentIds =
            enrollment.students?.map((s) => s.id) || [];

          // Check if student is already enrolled
          if (!existingStudentIds.includes(studentId)) {
            await strapi.entityService.update(
              "api::enrollment.enrollment",
              enrollmentId,
              {
                data: {
                  students: {
                    connect: [studentId],
                  },
                },
              }
            );
            console.log(
              `✅ Student ${studentId} enrolled in classroom ${enrollmentId}`
            );
          } else {
            console.log(
              `⚠️ Student ${studentId} already enrolled in classroom ${enrollmentId}`
            );
          }

          // If test series included, grant access
          if (payment.test_series_included) {
            console.log("✅ Granting test series access");
            await this.grantTestSeriesAccess(payment);
          }

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
        } catch (enrollmentError) {
          console.error("❌ Enrollment error:", enrollmentError);
          console.log("⚠️ Enrollment failed but payment recorded");
        }
      } else if (payment_type === "live_only") {
        // Grant access to live lectures
        console.log("✅ Granting live-only lecture access");
        await this.grantLiveLectureAccess(payment, payment_type);
      } else if (payment_type === "test_series_only") {
        // Grant access to test series
        console.log("✅ Granting test series access");
        await this.grantTestSeriesAccess(payment);
      }

      console.log("✅ Payment verified and processed successfully");

      return {
        success: true,
        payment: updatedPayment,
        message: "Payment verified successfully",
      };
    } catch (error) {
      console.error("❌ PAYMENT VERIFICATION ERROR:", error);
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);

      return ctx.internalServerError(
        "Payment verification failed: " + error.message
      );
    }
  },

  // 8. Grant test series access
  async grantTestSeriesAccess(payment) {
    try {
      console.log("=== GRANT TEST SERIES ACCESS ===");

      const studentId = payment.student?.id || payment.student;
      const enrollmentId = payment.classroom?.id || payment.classroom;

      if (!studentId || !enrollmentId) {
        console.error("❌ Missing student or enrollment ID");
        throw new Error("Missing student or enrollment ID");
      }

      // Get the grade_subject from enrollment
      const enrollment = await strapi.entityService.findOne(
        "api::enrollment.enrollment",
        enrollmentId,
        {
          populate: ["grade_subject"],
        }
      );

      if (!enrollment?.grade_subject) {
        console.error("❌ Grade subject not found for enrollment");
        throw new Error("Grade subject not found");
      }

      // Check if you have a test series model - you'll need to create this
      // For now, we'll just log and create a simple record
      const testSeriesData = {
        grade_subject: enrollment.grade_subject.id,
        student: studentId,
        classroom: enrollmentId,
        payment: payment.id,
        enrollment_date: new Date(),
        is_active: true,
        valid_until: new Date(
          new Date().setFullYear(new Date().getFullYear() + 1)
        ),
      };

      console.log("Test series access data:", testSeriesData);

      // If you have a test series enrollment model, create it here
      // Example: await strapi.entityService.create("api::test-series-enrollment.test-series-enrollment", { data: testSeriesData });

      // For now, we'll update the user's metadata or create a custom field
      await strapi.entityService.update(
        "plugin::users-permissions.user",
        studentId,
        {
          data: {
            test_series_access: [
              ...(payment.student?.test_series_access || []),
              {
                grade_subject_id: enrollment.grade_subject.id,
                classroom_id: enrollmentId,
                payment_id: payment.id,
                granted_at: new Date(),
                valid_until: new Date(
                  new Date().setFullYear(new Date().getFullYear() + 1)
                ),
              },
            ],
          },
        }
      );

      console.log("✅ Test series access granted for student:", studentId);
      return testSeriesData;
    } catch (error) {
      console.error("❌ GRANT TEST SERIES ACCESS ERROR:", error);
      throw error;
    }
  },

  // 9. Grant live lecture access
  async grantLiveLectureAccess(payment, payment_type = "classroom_with_live") {
    try {
      console.log("=== GRANT LIVE LECTURE ACCESS ===");

      const studentId = payment.student?.id || payment.student;
      const enrollmentId = payment.classroom?.id || payment.classroom;

      if (!studentId || !enrollmentId) {
        console.error("❌ Missing student or enrollment ID");
        throw new Error("Missing student or enrollment ID");
      }

      // Check if live lecture purchase already exists
      const existingPurchase = await strapi.db
        .query("api::live-lecture-purchase.live-lecture-purchase")
        .findOne({
          where: {
            enrollment: enrollmentId,
            student: studentId,
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
              ),
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
        enrollment: enrollmentId,
        student: studentId,
        payment: payment.id,
        lectures_purchased: payment.purchased_lectures || [],
        purchase_date: new Date(),
        valid_from: new Date(),
        valid_until: new Date(
          new Date().setFullYear(new Date().getFullYear() + 1)
        ),
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
        `✅ Live lecture access granted for student ${studentId}`,
        livePurchase.id
      );
      return livePurchase;
    } catch (error) {
      console.error("❌ GRANT LIVE LECTURE ACCESS ERROR:", error);
      console.error("Error details:", error.details || error.message);
      throw error;
    }
  },

  // 10. Check test series access
  async checkTestSeriesAccess(enrollmentId, studentId) {
    try {
      // Check if student already has test series access
      const user = await strapi.entityService.findOne(
        "plugin::users-permissions.user",
        studentId,
        {
          fields: ["test_series_access"],
        }
      );

      if (user?.test_series_access) {
        const hasAccess = user.test_series_access.some(
          (access) => access.classroom_id == enrollmentId
        );
        return hasAccess;
      }

      return false;
    } catch (error) {
      console.error("Check test series access error:", error);
      return false;
    }
  },

  // 11. Check student's access status (updated for test series)
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

      // Check test series access
      const testSeriesAccess = await this.checkTestSeriesAccess(
        enrollment_id,
        studentId
      );
      console.log("Test series access:", testSeriesAccess);

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
      }

      // Check if can purchase test series
      let canPurchaseTestSeries = false;
      let testSeriesPrice = null;

      if (classroomAccess && !testSeriesAccess) {
        testSeriesPrice = await this.calculateTestSeriesOnlyPrice(
          enrollment_id,
          studentId
        );
        canPurchaseTestSeries = testSeriesPrice.totalAmount > 0;
      }

      return {
        success: true,
        data: {
          classroom_access: classroomAccess,
          live_lecture_access: liveLectureAccess,
          live_lectures: liveLecturePurchase?.lectures_purchased || [],
          test_series_access: testSeriesAccess,
          can_purchase_live: canPurchaseLive,
          can_purchase_test_series: canPurchaseTestSeries,
          student_id: studentId,
          enrollment_id: enrollment_id,
          remaining_lectures_info: remainingLectures,
          test_series_info: testSeriesPrice,
        },
      };
    } catch (error) {
      console.error("Check access status error:", error);
      return ctx.internalServerError(error.message);
    }
  },

  // 12. Helper: Check classroom access
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

  // 13. Helper: Check live lecture access
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

  // 14. Get upcoming live lectures for student
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

  // 15. Helper: Calculate next class date based on schedule
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

  // 16. Simple test endpoint
  async testPayment(ctx) {
    try {
      console.log("=== TEST PAYMENT ENDPOINT ===");

      const envVars = {
        RAZORPAY_KEY_ID: !!process.env.RAZORPAY_KEY_ID,
        RAZORPAY_SECRET_ID: !!process.env.RAZORPAY_SECRET_ID,
      };

      console.log("Environment variables:", envVars);

      const testPayment = await strapi.entityService.findMany(
        "api::payment.payment",
        {
          limit: 1,
        }
      );

      console.log("Database connection:", testPayment ? "OK" : "Failed");

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

"use strict";

const Razorpay = require("razorpay");
const crypto = require("crypto");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
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

  while (currentDate <= endDate) {
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
      const { enrollment_id, include_live_lectures = false } = ctx.request.body;

      console.log("=== CREATE CLASSROOM ORDER ===");
      console.log("Enrollment ID:", enrollment_id);
      console.log("Include Live Lectures:", include_live_lectures);

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

      // Fetch enrollment details
      const enrollment = await strapi.entityService.findOne(
        "api::enrollment.enrollment",
        enrollment_id,
        {
          populate: ["students", "days", "live_lectures"],
        }
      );

      if (!enrollment) {
        return ctx.badRequest("Enrollment not found");
      }

      // Check if already enrolled
      const existingStudents = enrollment.students || [];
      if (existingStudents.some((student) => student.id === studentId)) {
        return ctx.badRequest("You are already enrolled in this classroom");
      }

      // Calculate price
      const calculation = await this.calculateClassroomPrice(
        enrollment_id,
        include_live_lectures,
        studentId
      );

      console.log("Price Calculation:", calculation);

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
          calculation: calculation,
        },
        payment_capture: 1,
      };

      console.log("Order data to Razorpay:", orderData);

      const order = await razorpay.orders.create(orderData);

      console.log("✅ Classroom order created:", order.id);

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
        commission_percentage_applied: calculation.commissionRate,
        commission_amount: calculation.commissionAmount,
        gst_amount: calculation.gstAmount,
        total_amount_paid: calculation.totalAmount,
        live_lectures_included: include_live_lectures,
        live_lectures_price: calculation.liveLecturesPrice,
        number_of_live_lectures: calculation.numberOfLectures,
        purchased_lectures: calculation.lectures,
        metadata: {
          calculation,
          purchase_date: new Date().toISOString(),
        },
      };

      const payment = await strapi.entityService.create(
        "api::payment.payment",
        {
          data: paymentData,
        }
      );

      console.log("✅ Payment record created:", payment.id);

      return {
        success: true,
        order,
        calculation,
        payment_id: payment.id,
      };
    } catch (error) {
      console.error("❌ CREATE CLASSROOM ORDER ERROR:", error);
      return ctx.internalServerError(error.message || "Failed to create order");
    }
  },

  // 2. Create live lectures only order (after classroom purchase)
  async createLiveLecturesOrder(ctx) {
    try {
      const { enrollment_id } = ctx.request.body;

      console.log("=== CREATE LIVE LECTURES ORDER ===");
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

      // Check if student has classroom access
      const hasClassroomAccess = await this.checkClassroomAccess(
        enrollment_id,
        studentId
      );
      if (!hasClassroomAccess) {
        return ctx.badRequest("You must enroll in the classroom first");
      }

      // Check if already has live lecture access
      const hasLiveAccess = await this.checkLiveLectureAccess(
        enrollment_id,
        studentId
      );
      if (hasLiveAccess) {
        return ctx.badRequest("You already have live lecture access");
      }

      // Calculate price for remaining live lectures
      const calculation = await this.calculateRemainingLiveLectures(
        enrollment_id,
        studentId
      );

      if (calculation.numberOfLectures === 0) {
        return ctx.badRequest(
          "No upcoming live lectures available for purchase"
        );
      }

      console.log("Live Lectures Calculation:", calculation);

      // Create Razorpay order
      const orderData = {
        amount: Math.round(calculation.totalAmount * 100),
        currency: "INR",
        receipt: `live_${enrollment_id}_${Date.now()}`,
        notes: {
          type: "live_only",
          enrollment_id,
          student_id: studentId,
          calculation: calculation,
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

  // 3. Calculate classroom price
  async calculateClassroomPrice(enrollmentId, includeLiveLectures, studentId) {
    const enrollment = await strapi.entityService.findOne(
      "api::enrollment.enrollment",
      enrollmentId,
      {
        populate: ["days", "live_lectures"],
      }
    );

    const basePrice = parseFloat(enrollment.base_price) || 0;

    let liveLecturesPrice = 0;
    let numberOfLectures = 0;
    let lectures = [];

    if (includeLiveLectures) {
      // Get upcoming lectures from today
      const today = new Date();
      const upcomingLectures =
        enrollment.live_lectures?.filter(
          (lecture) => new Date(lecture.scheduled_at) > today
        ) || [];

      numberOfLectures = upcomingLectures.length;
      const lecturePrice = parseFloat(enrollment.lecture_price) || 0;
      liveLecturesPrice = numberOfLectures * lecturePrice;
      lectures = upcomingLectures.map((l) => ({
        id: l.id,
        title: l.title,
        scheduled_at: l.scheduled_at,
        price: lecturePrice,
      }));
    }

    // Fetch GST data
    const gstData = await strapi.entityService.findMany("api::gst.gst", {
      filters: { is_active: true },
      limit: 1,
    });

    const gstRate = gstData.length > 0 ? parseFloat(gstData[0].gst_rate) : 0;

    // Fetch commission data
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

    const commissionRate =
      commissionData.length > 0
        ? parseFloat(commissionData[0].commission_percentage)
        : 0;

    // Calculate amounts
    const taxableAmount = basePrice + liveLecturesPrice;
    const gstAmount = (taxableAmount * gstRate) / 100;
    const commissionAmount = (liveLecturesPrice * commissionRate) / 100;
    const totalAmount =
      basePrice + liveLecturesPrice + commissionAmount + gstAmount;

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
  },

  // 4. Calculate remaining live lectures
  async calculateRemainingLiveLectures(enrollmentId, studentId) {
    const enrollment = await strapi.entityService.findOne(
      "api::enrollment.enrollment",
      enrollmentId,
      {
        populate: ["live_lectures", "days"],
      }
    );

    const today = new Date();

    // Get all upcoming lectures
    const allUpcomingLectures =
      enrollment.live_lectures?.filter(
        (lecture) => new Date(lecture.scheduled_at) > today
      ) || [];

    // Get lectures student already has access to
    const existingPurchase = await strapi.db
      .query("api::live-lecture-purchase.live-lecture-purchase")
      .findOne({
        where: {
          enrollment: enrollmentId,
          student: studentId,
          is_active: true,
        },
      });

    const alreadyPurchasedLectureIds =
      existingPurchase?.lectures_purchased?.map((l) => l.id) || [];

    // Filter out already purchased lectures
    const lecturesToPurchase = allUpcomingLectures.filter(
      (lecture) => !alreadyPurchasedLectureIds.includes(lecture.id)
    );

    const lecturePrice = parseFloat(enrollment.lecture_price) || 0;
    const liveLecturesPrice = lecturesToPurchase.length * lecturePrice;

    // Fetch GST data
    const gstData = await strapi.entityService.findMany("api::gst.gst", {
      filters: { is_active: true },
      limit: 1,
    });

    const gstRate = gstData.length > 0 ? parseFloat(gstData[0].gst_rate) : 0;

    // Fetch commission data
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

    const commissionRate =
      commissionData.length > 0
        ? parseFloat(commissionData[0].commission_percentage)
        : 0;

    // Calculate amounts
    const gstAmount = (liveLecturesPrice * gstRate) / 100;
    const commissionAmount = (liveLecturesPrice * commissionRate) / 100;
    const totalAmount = liveLecturesPrice + commissionAmount + gstAmount;

    return {
      liveLecturesPrice,
      numberOfLectures: lecturesToPurchase.length,
      lectures: lecturesToPurchase.map((l) => ({
        id: l.id,
        title: l.title,
        scheduled_at: l.scheduled_at,
        price: lecturePrice,
      })),
      gstRate,
      gstAmount,
      commissionRate,
      commissionAmount,
      totalAmount,
    };
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
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest("hex");

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
        return ctx.badRequest("Payment record not found");
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
            purchased_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
          },
        }
      );

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
          await this.grantLiveLectureAccess(payment);
        }
      } else if (payment_type === "live_only") {
        // Grant access to live lectures
        await this.grantLiveLectureAccess(payment);
      }

      console.log("✅ Payment verified and processed successfully");

      return {
        success: true,
        payment: updatedPayment,
        message: "Payment verified successfully",
      };
    } catch (error) {
      console.error("❌ PAYMENT VERIFICATION ERROR:", error);
      return ctx.internalServerError("Payment verification failed");
    }
  },

  // 6. Grant live lecture access
  async grantLiveLectureAccess(payment) {
    // Create live lecture purchase record
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

    const livePurchase = await strapi.entityService.create(
      "api::live-lecture-purchase.live-lecture-purchase",
      {
        data: livePurchaseData,
      }
    );

    console.log(
      `✅ Live lecture access granted for student ${payment.student.id}`
    );
    return livePurchase;
  },

  // 7. Check student's access status
  async checkAccessStatus(ctx) {
    try {
      const { enrollment_id } = ctx.params;

      // Get user from token
      const token = ctx.request.header.authorization?.replace("Bearer ", "");
      if (!token) {
        return ctx.unauthorized("Authorization token missing");
      }

      const { id: studentId } = await strapi.plugins[
        "users-permissions"
      ].services.jwt.verify(token);

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

      // Check if can purchase live lectures
      let canPurchaseLive = false;
      if (classroomAccess && !liveLectureAccess) {
        const remainingLectures = await this.calculateRemainingLiveLectures(
          enrollment_id,
          studentId
        );
        canPurchaseLive = remainingLectures.numberOfLectures > 0;
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
        },
      };
    } catch (error) {
      console.error("Check access status error:", error);
      return ctx.internalServerError(error.message);
    }
  },

  // 8. Helper: Check classroom access
  async checkClassroomAccess(enrollmentId, studentId) {
    const enrollment = await strapi.entityService.findOne(
      "api::enrollment.enrollment",
      enrollmentId,
      {
        populate: ["students"],
      }
    );

    return (
      enrollment?.students?.some((student) => student.id === studentId) || false
    );
  },

  // 9. Helper: Check live lecture access
  async checkLiveLectureAccess(enrollmentId, studentId) {
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
  },

  // 10. Get upcoming live lectures for student
  async getUpcomingLiveLectures(ctx) {
    try {
      const { enrollment_id } = ctx.params;

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

      // Get all upcoming lectures
      const enrollment = await strapi.entityService.findOne(
        "api::enrollment.enrollment",
        enrollment_id,
        {
          populate: ["live_lectures"],
        }
      );

      const today = new Date();
      const allUpcomingLectures =
        enrollment.live_lectures?.filter(
          (lecture) => new Date(lecture.scheduled_at) > today
        ) || [];

      // Get purchased lecture IDs
      const livePurchase = await strapi.db
        .query("api::live-lecture-purchase.live-lecture-purchase")
        .findOne({
          where: {
            enrollment: enrollment_id,
            student: studentId,
            is_active: true,
          },
        });

      const purchasedLectureIds =
        livePurchase?.lectures_purchased?.map((l) => l.id) || [];

      // Separate purchased and available lectures
      const purchasedLectures = allUpcomingLectures.filter((lecture) =>
        purchasedLectureIds.includes(lecture.id)
      );

      const availableLectures = allUpcomingLectures.filter(
        (lecture) => !purchasedLectureIds.includes(lecture.id)
      );

      return {
        success: true,
        data: {
          purchased_lectures: purchasedLectures,
          available_lectures: availableLectures,
          total_upcoming: allUpcomingLectures.length,
          has_live_access: !!livePurchase,
          lecture_price: enrollment.lecture_price || 0,
        },
      };
    } catch (error) {
      console.error("Get upcoming lectures error:", error);
      return ctx.internalServerError(error.message);
    }
  },
};

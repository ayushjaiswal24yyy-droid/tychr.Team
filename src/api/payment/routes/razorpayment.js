module.exports = {
  routes: [
    {
      method: "POST",
      path: "/payment/create-classroom-order",
      handler: "razorpayment.createClassroomOrder",
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "POST",
      path: "/payment/create-live-lectures-order",
      handler: "razorpayment.createLiveLecturesOrder",
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "POST",
      path: "/payment/verify",
      handler: "razorpayment.verifyPayment",
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "GET",
      path: "/payment/access-status/:enrollment_id",
      handler: "razorpayment.checkAccessStatus",
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "GET",
      path: "/payment/upcoming-lectures/:enrollment_id",
      handler: "razorpayment.getUpcomingLiveLectures",
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};

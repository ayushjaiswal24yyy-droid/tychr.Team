module.exports = {
  routes: [
    // 1. Create initial classroom order (with or without live lectures)
    {
      method: "POST",
      path: "/payment/create-classroom-order",
      handler: "razorpayment.createClassroomOrder",
      config: {
        policies: [],
        middlewares: [],
      },
    },

    // 2. Add live lectures to existing subscription
    {
      method: "POST",
      path: "/payment/add-live-lectures",
      handler: "razorpayment.addLiveLectures",
      config: {
        policies: [],
        middlewares: [],
      },
    },

    // 3. Add test series to existing subscription
    {
      method: "POST",
      path: "/payment/add-test-series",
      handler: "razorpayment.createTestSeriesAddonOrder",
      config: {
        policies: [],
        middlewares: [],
      },
    },

    // 4. Verify payment (all types)
    {
      method: "POST",
      path: "/payment/verify",
      handler: "razorpayment.verifyPayment",
      config: {
        policies: [],
        middlewares: [],
      },
    },

    // 5. Handle payment failed
    {
      method: "POST",
      path: "/payment/failed",
      handler: "razorpayment.handlePaymentFailed",
      config: {
        policies: [],
        middlewares: [],
      },
    },

    // 6. Get subscription status
    {
      method: "GET",
      path: "/payment/subscription-status/:enrollment_id",
      handler: "razorpayment.getSubscriptionStatus",
      config: {
        policies: [],
        middlewares: [],
      },
    },

    // 7. Get upcoming live lectures (considering subscription)
    {
      method: "GET",
      path: "/payment/upcoming-lectures/:enrollment_id",
      handler: "razorpayment.getUpcomingLiveLectures",
      config: {
        policies: [],
        middlewares: [],
      },
    },

    // 8. Calculate minimum live lectures price
    {
      method: "GET",
      path: "/payment/minimum-live-price/:enrollment_id",
      handler: "razorpayment.calculateMinimumLiveLecturesPrice",
      config: {
        policies: [],
        middlewares: [],
      },
    },

    // 9. Mark live lecture as consumed
    {
      method: "POST",
      path: "/payment/consume-lecture",
      handler: "razorpayment.consumeLiveLecture",
      config: {
        policies: [],
        middlewares: [],
      },
    },

    // 10. Get student's classroom subscriptions
    {
      method: "GET",
      path: "/payment/my-subscriptions",
      handler: "razorpayment.getMySubscriptions",
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};

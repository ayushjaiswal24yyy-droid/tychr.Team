module.exports = {
  routes: [
    // Create Razorpay order
    {
      method: "POST",
      path: "/payment/create-addon-order",
      handler: "payment.createOrder",
      config: {
        policies: [],
        middlewares: [],
      },
    },

    // Verify payment
    {
      method: "POST",
      path: "/payment/verify-addon-payment",
      handler: "payment.verifyPayment",
      config: {
        policies: [],
        middlewares: [],
      },
    },

    // Handle failed payment
    {
      method: "POST",
      path: "/payment/addon-payment-failed",
      handler: "payment.handleFailedPayment",
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};

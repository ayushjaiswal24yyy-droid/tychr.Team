module.exports = {
  routes: [
    {
      method: "POST",
      path: "/payment/razorpayment",
      handler: "razorpayment.createOrder",
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};

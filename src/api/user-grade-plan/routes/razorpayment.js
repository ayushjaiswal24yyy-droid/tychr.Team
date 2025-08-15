module.exports = {
  routes: [
    {
      method: "POST",
      path: "/user-grad-plan/razorpayment",
      handler: "razorpayment.createOrder",
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "POST",
      path: "/user-grad-plan/verify-payment",
      handler: "razorpayment.verifyPayment",
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
  //   routes: [
  //   {
  //     method: 'POST',
  //     path: '/payments/create-order',
  //     handler: 'payment.createOrder',
  //     config: {
  //       policies: [],
  //       middlewares: [],
  //     },
  //   },
  //   {
  //     method: 'POST',
  //     path: '/payments/verify',
  //     handler: 'payment.verifyPayment',
  //     config: {
  //       policies: [],
  //       middlewares: [],
  //     },
  //   },
  // ],
};

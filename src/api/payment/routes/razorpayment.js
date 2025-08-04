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
    {
      method: "POST",
      path: "/payment/verify-payment",
      handler: "razorpayment.verifyPayment",
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "GET",
      path: "/payment/invoices/:id",
      handler: "razorpayment.downloadInvoiceInstant",
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

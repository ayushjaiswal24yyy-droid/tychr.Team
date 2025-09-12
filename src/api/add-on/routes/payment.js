module.exports = {
  routes: [
    {
      method: "POST",
      path: "/payment/add-on-order",
      handler: "payment.completeAddOnTransaction",
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

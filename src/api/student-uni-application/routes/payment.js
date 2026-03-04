"use strict";

module.exports = {
  routes: [
    {
      method: "POST",
      path: "/student-uni-applications/create-application-fee-order",
      handler: "payment.createApplicationFeeOrder",
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "POST",
      path: "/student-uni-applications/verify-application-fee",
      handler: "payment.verifyApplicationFee",
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "POST",
      path: "/student-uni-applications/:id/submit",
      handler: "payment.submitApplication",
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
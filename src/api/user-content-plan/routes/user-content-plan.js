"use strict";

module.exports = {
  routes: [
    {
      method: "POST",
      path: "/user-content-plans/create-order",
      handler: "user-content-plan.createOrder",
      config: {
        policies: ["global::is-authenticated"],
      },
    },
    {
      method: "POST",
      path: "/user-content-plans/verify-payment",
      handler: "user-content-plan.verifyPayment",
      config: {
        policies: ["global::is-authenticated"],
      },
    },
    {
      method: "GET",
      path: "/user-content-plans/upgrade-preview",
      handler: "user-content-plan.upgradePreview",
      config: {
        policies: [],
        middlewares: [],
      },
    }

  ],
};

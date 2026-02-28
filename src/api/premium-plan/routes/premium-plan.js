"use strict";

const { createCoreRouter } = require("@strapi/strapi").factories;

module.exports = createCoreRouter("api::premium-plan.premium-plan", {
  config: {
    createOrder: {
      policies: [],
      middlewares: [],
    },
    verifyPayment: {
      policies: [],
      middlewares: [],
    },
  },
  routes: [
    {
      method: "POST",
      path: "/premium-plans/create-order",
      handler: "premium-plan.createOrder",
    },
    {
      method: "POST",
      path: "/premium-plans/verify-payment",
      handler: "premium-plan.verifyPayment",
    },
  ],
});
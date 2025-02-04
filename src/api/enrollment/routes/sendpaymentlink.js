module.exports = {
  routes: [
    {
      method: "POST",
      path: "/enrollment/sendpaymentlink",
      handler: "sendpaymentlink.sendPaymentLink",
    },
  ],
};

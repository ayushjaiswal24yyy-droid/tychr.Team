module.exports = {
  routes: [
    {
      method: "POST",
      path: "/send-email",
      handler: "send-email.sendEmailToAddress",
      config: {
        policies: [],
      },
    },
  ],
};

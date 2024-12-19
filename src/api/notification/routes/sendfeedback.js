module.exports = {
  routes: [
    {
      method: "POST",
      path: "/notification/sendfeedback",
      handler: "sendfeedback.sendFeedbackEmail",
    },
  ],
};

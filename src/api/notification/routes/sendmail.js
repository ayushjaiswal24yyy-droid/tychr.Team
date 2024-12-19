module.exports = {
  routes: [
    {
      method: "POST",
      path: "/notification/sendmail",
      handler: "sendmail.sendEnquiryEmails",
    },
  ],
};

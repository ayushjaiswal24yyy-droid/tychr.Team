module.exports = {
  routes: [
    {
      method: "POST",
      path: "/enrollment/sendmail",
      handler: "sendmail.index",
    },
  ],
};

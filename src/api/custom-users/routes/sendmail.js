module.exports = {
  routes: [
    {
      method: "POST",
      path: "/custom-users/sendmail",
      handler: "sendmail.index",
    },
  ],
};

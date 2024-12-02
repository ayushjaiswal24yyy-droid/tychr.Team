module.exports = {
  routes: [
    {
      method: "POST",
      path: "/enrollment/sendapprovalemail",
      handler: "sendapprovalemail.index",
    },
  ],
};

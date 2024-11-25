module.exports = {
  routes: [
    {
      method: "GET",
      path: "/custom-users",
      handler: "custom-users.find",
      config: {
        auth: false, 
      },
    },
  ],
};

module.exports = {
  routes: [
    {
      method: "GET",
      path: "/class/demovideos",
      handler: "demovideos.find",
      config: {
        auth: false,
      },
    },
  ],
};

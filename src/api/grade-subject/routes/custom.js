module.exports = {
  routes: [
    {
      method: "GET",
      path: "/grade-subjects/:id/topic", // :id parameter add karo
      handler: "custom.findWithDetails",
    },
    {
      method: "GET",
      path: "/grade-subjects/filtered",
      handler: "custom.findFiltered",
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};

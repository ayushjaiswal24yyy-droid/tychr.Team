module.exports = {
  routes: [
    {
      method: "GET",
      path: "/grade-subject/topic",
      handler: "custom.findWithDetails",
    },
  ],
};

module.exports = {
  routes: [
    {
      method: "GET",
      path: "/grade-subjects/:id/topic", // :id parameter add karo
      handler: "custom.findWithDetails",
    },
  ],
};

"use strict";

module.exports = {
  routes: [
    {
      method: "POST",
      path: "/enrollments/create",
      handler: "tutor.createCustomClassroom",
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "POST",
      path: "/enrollments/validate",
      handler: "tutor.validateClassroomData",
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "PUT",
      path: "/enrollments/:id/update",
      handler: "tutor.updateCustomClassroom",

    },
  ],
};

"use strict";

module.exports = {
  routes: [
    {
      method: "GET",
      path: "/demo-bookings/availability/:tutorId/:date",
      handler: "booking.getTutorAvailability",
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "POST",
      path: "/demo-bookings",
      handler: "booking.create",
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "GET",
      path: "/demo-bookings",
      handler: "booking.find",
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "PUT",
      path: "/demo-bookings/:id/status",
      handler: "booking.updateStatus",
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "GET",
      path: "/demo-bookings/student/:studentId",
      handler: "booking.findByStudent",
      config: {
        // auth: false, // Set to true if you need authentication
        policies: [],
        middlewares: [],
      },
    },
  ],
};

"use strict";

module.exports = {
  routes: [
    {
      method: "POST",
      path: "/attendances/bulk-update",
      handler: "tutor.bulkUpdate",
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "POST",
      path: "/attendances/initialize",
      handler: "tutor.initializeForLecture",
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "GET",
      path: "/attendances/lecture/:lectureId",
      handler: "tutor.getLectureAttendance",
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};

"use strict";

module.exports = {
  routes: [
    {
      method: "GET",
      path: "/student-notifications",
      handler: "notifications.findForStudent",

    },
    {
      method: "GET",
      path: "/student-notifications/counts",
      handler: "notifications.getCounts",
       
    },
    {
      method: "PUT",
      path: "/student-notifications/:id/read",
      handler: "notifications.markAsRead",
       
    },
    {
      method: "POST",
      path: "/student-notifications/mark-all-read",
      handler: "notifications.markAllAsRead",
       
    },
    {
      method: "PUT",
      path: "/student-notifications/:id/archive",
      handler: "notifications.archive",
       
    },
    {
      method: "POST",
      path: "/student-notifications/create",
      handler: "notifications.createNotification",
       
    },
    {
      method: "POST",
      path: "/student-notifications/classroom",
      handler: "notifications.createClassroomNotification",
       
    },
  ],
};

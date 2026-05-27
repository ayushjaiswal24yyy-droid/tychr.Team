"use strict";

module.exports = {
  routes: [
    {
      method: "POST",
      path: "/live-lectures",
      handler: "live-lecture.create",
      config: { policies: [] },
    },
    {
      method: "GET",
      path: "/live-lectures",
      handler: "live-lecture.find",
      config: { policies: [] },
    },
    {
      method: "GET",
      path: "/live-lectures/:id",
      handler: "live-lecture.findOne",
      config: { policies: [] },
    },
    {
      method: "PUT",
      path: "/live-lectures/:id",
      handler: "live-lecture.update",
      config: { policies: [] },
    },
    {
      method: "DELETE",
      path: "/live-lectures/:id",
      handler: "live-lecture.delete",
      config: { policies: [] },
    },
  ],
};

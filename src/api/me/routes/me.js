"use strict";

module.exports = {
  routes: [
    {
      method: "GET",
      path: "/me/content-plan",
      handler: "me.contentPlan",
      config: {
        policies: ["global::is-authenticated"],
      },
    },
    {
  method: "GET",
  path: "/me/subtopic-notes/:id",
  handler: "me.subtopicNotes",
}

  ],
};

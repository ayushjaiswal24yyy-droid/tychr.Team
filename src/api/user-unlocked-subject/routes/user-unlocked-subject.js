"use strict";

module.exports = {
  routes: [
    {
      method: "POST",
      path: "/user-unlocked-subjects/unlock",
      handler: "user-unlocked-subject.unlock",
      config: {
        policies: ["global::is-authenticated"],
      },
    },
  ],
};

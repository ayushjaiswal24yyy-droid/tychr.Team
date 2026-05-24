"use strict";

const { createCoreRouter } = require("@strapi/strapi").factories;

module.exports = createCoreRouter(
  "api::question-paper-template.question-paper-template",
  {
    config: {
      create: {
        policies: ["global::is-admin"],
      },
      update: {
        policies: ["global::is-admin"],
      },
      delete: {
        policies: ["global::is-admin"],
      },
    },
  }
);

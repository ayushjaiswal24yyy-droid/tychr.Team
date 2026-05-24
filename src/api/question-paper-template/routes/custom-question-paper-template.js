"use strict";

module.exports = {
  routes: [
    {
      method: "POST",
      path: "/question-paper-templates/from-paper/:paperId",
      handler: "question-paper-template.createFromPaper",
      config: {
        policies: ["global::is-admin"],
        middlewares: [],
      },
    },
    {
      method: "POST",
      path: "/question-paper-templates/:id/duplicate-to-paper",
      handler: "question-paper-template.duplicateTemplateToPaper",
      config: {
        policies: ["global::is-admin"],
        middlewares: [],
      },
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// src/api/ai-tutor/routes/ai-tutor.js
// ─────────────────────────────────────────────────────────────────────────────
// Create the folder: src/api/ai-tutor/routes/ and put this file there.
// Also create: src/api/ai-tutor/controllers/ai-tutor.js (see below)

"use strict";

module.exports = {
  routes: [
    {
      method: "POST",
      path: "/ai-tutor/chat",
      handler: "ai-tutor.chat",
      config: {
        middlewares: [],
      },
    },
    {
      method: "POST",
      path: "/ai-tutor/generate-questions",
      handler: "ai-tutor.generateQuestions",
      config: {
        middlewares: [],
      },
    },
  ],
};
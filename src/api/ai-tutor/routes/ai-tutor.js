// ─────────────────────────────────────────────────────────────────────────────
// src/api/ai-tutor/routes/ai-tutor.js
// ─────────────────────────────────────────────────────────────────────────────

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
    {
      method: "POST",
      path: "/ai-tutor/generate-paper-questions",
      handler: "ai-tutor.generatePaperQuestions",
      config: {
        middlewares: [],
      },
    },
    {
      method: "POST",
      path: "/ai-tutor/learning-path",
      handler: "ai-tutor.generateLearningPath",
      config: {
        middlewares: [],
      },
    },
  ],
};
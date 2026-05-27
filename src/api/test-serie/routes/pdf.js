module.exports = {
  routes: [
    {
      method: "GET",
      path: "/test-series/:id/pdf",
      handler: "pdf.generate",
      config: {
        policies: []
      },
    },
    {
      method: "GET",
      path: "/test-series/:id/solutions",
      handler: "pdf.solutions",
      config: { policies: [] },
    },
    {
      method: "GET",
      path: "/test-series/:id/result",
      handler: "pdf.result",
      config: { policies: [] },
    },
    {
      method: "POST",
      path: "/test-series/:id/results/export-pdfs",
      handler: "pdf.exportResultsBatch",
      config: { policies: [] },
    },
  ],
};

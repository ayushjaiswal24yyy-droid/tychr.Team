module.exports= {
  routes: [
    {
      method: "GET",
      path: "/test-series/:id/pdf",
      handler: "pdf.generate",
      config: {
       policies:[]
      },
    },
  ],
};

module.exports= {
  routes: [
    {
      method: "GET",
      path: "/test-papers/:id/pdf",
      handler: "pdf.generate",
      config: {
       policies:[]
      },
    },
  ],
};

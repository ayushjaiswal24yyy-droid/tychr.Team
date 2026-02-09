"use strict"

module.exports = {
  routes: [
    {
      method: "GET",
      path: "/auth/microsoft",
      handler: "microsoft.redirect",
      config: {
        auth: false,
      },
    },
    {
      method: "GET",
      path: "/auth/microsoft/callback",
      handler: "microsoft.callback",
      config: {
        auth: false,
      },
    },
  ],
};

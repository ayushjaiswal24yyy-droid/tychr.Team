"use strict";
const { Server } = require("socket.io");

module.exports = {
  register({ strapi }) {
    const allowedOrigins =
      process.env.NODE_ENV === "production"
        ? ["https://tychr.pages.dev/"]
        : "*";

    const io = new Server(strapi.server.httpServer, {
      cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"],
      },
      path: "/socket.io",
    });

    strapi.io = io;

    strapi.log.info("WebSocket server initialized");

    io.on("connection", (socket) => {
      strapi.log.info(`Client connected: ${socket.id}`);

      socket.on("disconnect", () => {
        strapi.log.info(`Client disconnected: ${socket.id}`);
      });

      socket.on("error", (err) => {
        strapi.log.error(`WebSocket error: ${err.message}`);
      });
    });

    process.on("SIGINT", () => {
      strapi.log.info("Shutting down WebSocket server...");
      io.close(() => {
        strapi.log.info("WebSocket server closed");
        process.exit(0);
      });
    });
  },

  bootstrap() {},
};

"use strict";

module.exports = {
  register({ strapi }) {
    const io = require("socket.io")(strapi.server.httpServer, {
      cors: {
        origin: "*", // Replace * with your frontend URL for security
        methods: ["GET", "POST"],
      },
    });

    // Store `io` globally in Strapi
    strapi.io = io;

    // Socket events
    io.on("connection", (socket) => {
      console.log("A user connected", socket.id);

      // Listen for joining a community room
      socket.on("joinCommunity", (communityId) => {
        socket.join(`community-${communityId}`);
        console.log(`User joined community-${communityId}`);
      });

      socket.on("newPost", (data) => {
        const { communityId, post } = data;

        io.to(`community-${communityId}`).emit("newPostAdded", post);
        console.log(post);
        console.log(`New post added in community-${communityId}`);
      });

      // Handle disconnection
      socket.on("disconnect", () => {
        console.log("User disconnected", socket.id);
      });
    });
  },

  bootstrap() {},
};

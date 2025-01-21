"use strict";

module.exports = {
  register({ strapi }) {
    const io = require("socket.io")(strapi.server.httpServer, {
      cors: {
        origin: "*", 
        methods: ["GET", "POST"],
      },
    });

    strapi.io = io;

    io.on("connection", (socket) => {
      console.log("A user connected", socket.id);

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

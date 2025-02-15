"use strict";
const { Server } = require('socket.io');


module.exports = {
  register({ strapi }) {
    const io = new Server(strapi.server.httpServer, {
      cors: {
        origin: "*", 
        methods: ["GET", "POST"],
      },
    });

    strapi.io = io;

    io.on('connection', (socket) => {
      console.log('A client connected:', socket.id);

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log('A client disconnected:', socket.id);
      });
    });
  },

  bootstrap() {},
};

'use strict';

let io = null;

module.exports = {
  init(server) {
    const { Server } = require('socket.io');
    io = new Server(server, {
      cors: {
        origin: process.env.FRONTEND_URL || '*',
        methods: ['GET', 'POST'],
        credentials: true,
      },
    });
    return io;
  },

  getIO() {
    if (!io) throw new Error('Socket.io not initialized');
    return io;
  },
};
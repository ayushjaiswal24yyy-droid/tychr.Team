const cron = require('node-cron');
const cronTasks = require('./cron-tasks');
const { Server } = require('socket.io');

module.exports = ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  logger: {
    updates: {
      enabled: false,
    },
    startup: {
      enabled: false,
    },
  },
  cron: {
    enabled: true,
    driver: cron,
    tasks: cronTasks,
  },
  proxy: env.bool('IS_PROXIED', true),
  app: {
    keys: env.array('APP_KEYS'),
  },
  webhooks: {
    populateRelations: env.bool('WEBHOOKS_POPULATE_RELATIONS', false),
  },
  bootstrap() {
    // Initialize WebSocket server
    const io = new Server(strapi.server.httpServer, {
      cors: {
        origin: "*", 
        methods: ["GET", "POST"],
      },
    });

    // @ts-ignore
    strapi.io = io;

    // Handle WebSocket connections
    io.on('connection', (socket) => {
      console.log('A client connected:', socket.id);

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log('A client disconnected:', socket.id);
      });
    });
  },
});
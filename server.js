import './src/config/env.js';
import app from './src/app.js';
import mongoCtx from './src/config/db.config.js';
import redisClient from './src/config/redis-config.js';
import { initSocket } from './src/config/socket.js';
import mongoose from 'mongoose';
import http from 'http';
const PORT = process.env.PORT || 8000;
let server;
// sync crash error
process.on('uncaughtException', async err => {
  console.error('UNCAUGHT EXCEPTION:', err);
  await mongoose.connection.close();
  process.exit(1);
});

const startServer = async () => {
  try {
    await Promise.all([mongoCtx(), redisClient.connect()]);
    server = http.createServer(app);
    initSocket(server);
    server.listen(PORT, () => {
      console.log(`Server is listening on ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
// during promise related error
process.on('unhandledRejection', async err => {
  console.error('UNHANDLED REJECTION:', err);
  server.close(async () => {
    await mongoose.connection.close();
    await redisClient.quit();
    process.exit(1);
  });
});

process.on('SIGTERM', () => {
  console.log('SIGTERM RECEIVED. Shutting down gracefully');
  server.close(async () => {
    await mongoose.connection.close();
    await redisClient.quit();
    process.exit(0);
  });
});
// CTRL + C
process.on('SIGINT', () => {
  console.log('SIGINT RECEIVED. Shutting down gracefully');
  server.close(async () => {
    await mongoose.connection.close();
    await redisClient.quit();
    process.exit(0);
  });
});

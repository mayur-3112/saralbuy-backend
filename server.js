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
    // 1. Connect to MongoDB (Required)
    await mongoCtx();

    // 2. Connect to Redis (Optional)
    if (process.env.REDIS_URL) {
      try {
        await redisClient.connect();
      } catch (redisErr) {
        console.warn(
          '⚠️ Warning: Redis connection failed. Running without caching fallback.',
          redisErr.message
        );
      }
    } else {
      console.warn('⚠️ Warning: REDIS_URL not configured. Running without Redis caching.');
    }

    server = http.createServer(app);
    await initSocket(server);
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
  if (server) {
    server.close(async () => {
      try { await mongoose.connection.close(); } catch (e) { /* ignore */ }
      try { if (redisClient?.isOpen) await redisClient.quit(); } catch (e) { /* ignore */ }
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
});

process.on('SIGTERM', () => {
  console.log('SIGTERM RECEIVED. Shutting down gracefully');
  if (server) {
    server.close(async () => {
      try { await mongoose.connection.close(); } catch (e) { /* ignore */ }
      try { if (redisClient?.isOpen) await redisClient.quit(); } catch (e) { /* ignore */ }
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});
// CTRL + C
process.on('SIGINT', () => {
  console.log('SIGINT RECEIVED. Shutting down gracefully');
  if (server) {
    server.close(async () => {
      try { await mongoose.connection.close(); } catch (e) { /* ignore */ }
      try { if (redisClient?.isOpen) await redisClient.quit(); } catch (e) { /* ignore */ }
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

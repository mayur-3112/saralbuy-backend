import './src/config/env.js';
import app from './src/app.js';
import mongoCtx from './src/config/db.config.js';
import redisClient from './src/config/redis-config.js';
const PORT = process.env.PORT || 8000;

const startServer = async () => {
  try {
    await Promise.all([mongoCtx(), redisClient.connect()]);
    app.listen(PORT, () => {
      console.log(`Server is listening on ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

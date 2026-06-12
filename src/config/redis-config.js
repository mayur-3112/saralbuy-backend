import { createClient } from 'redis';

let redisClient = null;

if (process.env.REDIS_URL) {
  redisClient = createClient({
    url: process.env.REDIS_URL,
  });

  redisClient.on('error', err => {
    console.log('Redis Error', err.message);
  });

  redisClient.on('connect', () => {
    console.log('Connected to Redis');
  });
}

export default redisClient;

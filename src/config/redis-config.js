import dotenv from 'dotenv';
import { createClient } from 'redis';

dotenv.config();

const redisClient = createClient({
  url: process.env.REDIS_URL,
});

redisClient.on('error', err => {
  console.log('Redis Error', err);
});

redisClient.on('connect', () => {
  console.log('Connected to Redis');
});

export default redisClient;

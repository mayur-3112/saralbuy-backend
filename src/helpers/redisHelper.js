import redisClient from '../config/redis-config.js';

class RedisHelper {
  constructor() {
    this.redisClient = redisClient;
  }

  async set(key, value, ttl = 3600) {
    if (!key?.trim() || value === undefined || value === null) {
      throw new Error('KEY AND VALUE IS REQUIRED');
    }

   return  await this.redisClient.set(
      key,
      JSON.stringify(value),
      { EX: ttl }
    );
  }

  async get(key) {
    const exists = await this.redisClient.exists(key);

    if (exists) {
      const result = await this.redisClient.get(key);
      return JSON.parse(result);
    }

    return null;
  }
}

export default new RedisHelper();
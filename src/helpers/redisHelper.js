import redisClient from '../config/redis-config.js';

class RedisHelper {
  constructor() {
    this.redisClient = redisClient;
  }

  async set(key, value, ttl = 3600) {
    if (!key?.trim() || value === undefined || value === null) {
      throw new Error('KEY AND VALUE IS REQUIRED');
    }

    await this.redisClient.set(
      key,
      JSON.stringify(value),
      { EX: ttl }
    );

    return true;
  }

  async get(key) {
    const exists = await this.redisClient.exists(key);

    if (exists) {
      const result = await this.redisClient.get(key);
      return JSON.parse(result);
    }

    return false;
  }
}

export default new RedisHelper();
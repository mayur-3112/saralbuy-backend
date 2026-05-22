import redisClient from '../config/redis-config.js';
class RedisHelper {
  constructor() {
    this.redisClient = redisClient;
  }

  async set(key, value, ttl = 3600) {
    if (!key?.trim() || !value) {
      throw new Error('KEY AND VALUE IS REQUIRED.....');
    }
    await this.redisClient.set(key, JSON.stringify(value), { expiration: ttl });
    return true;
  }

  async get(key) {
    if (await this.redisClient.exists(key)) {
      const result = await redisClient.get(key);
      return JSON.parse(result);
    }
    return false;
  }
}
export default new RedisHelper();

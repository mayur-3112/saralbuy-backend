import redisClient from '../config/redis-config.js';

class RedisHelper {
  constructor() {
    this.redisClient = redisClient;
    this.memoryCache = new Map();
  }

  async set(key, value, ttl = 3600) {
    if (!key?.trim() || value === undefined || value === null) {
      throw new Error('KEY AND VALUE IS REQUIRED');
    }

    try {
      if (this.redisClient && this.redisClient.isOpen) {
        return await this.redisClient.set(key, JSON.stringify(value), { EX: ttl });
      }
    } catch (err) {
      console.warn('Redis SET error, falling back to memory:', err.message);
    }

    // In-memory fallback with TTL
    const expiry = Date.now() + ttl * 1000;
    this.memoryCache.set(key, { value, expiry });
    return 'OK';
  }

  async get(key) {
    try {
      if (this.redisClient && this.redisClient.isOpen) {
        const exists = await this.redisClient.exists(key);
        if (exists) {
          const result = await this.redisClient.get(key);
          return JSON.parse(result);
        }
      }
    } catch (err) {
      console.warn('Redis GET error, falling back to memory:', err.message);
    }

    // In-memory fallback with expiration check
    const cached = this.memoryCache.get(key);
    if (cached) {
      if (Date.now() < cached.expiry) {
        return cached.value;
      }
      // Clean up expired item
      this.memoryCache.delete(key);
    }

    return null;
  }

  async del(key) {
    try {
      if (this.redisClient && this.redisClient.isOpen) {
        await this.redisClient.del(key);
      }
    } catch (err) {
      console.warn('Redis DEL error, falling back to memory:', err.message);
    }

    // In-memory fallback delete
    this.memoryCache.delete(key);
    return true;
  }
}

export default new RedisHelper();

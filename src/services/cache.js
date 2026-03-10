import { createClient } from 'redis';
import config from '../config/index.js';
import logger from '../utils/logger.js';

let client = null;
let connected = false;

async function getClient() {
  if (client && connected) return client;

  try {
    client = createClient({ url: config.redis.url });
    client.on('error', (err) => {
      logger.debug('Redis error', { error: err.message });
      connected = false;
    });
    client.on('connect', () => {
      connected = true;
    });
    await client.connect();
    logger.info('Redis cache connected');
    return client;
  } catch (err) {
    logger.debug('Redis connection failed, caching disabled', { error: err.message });
    connected = false;
    return null;
  }
}

const DEFAULT_TTL = 900; // 15 minutes

/**
 * Get a cached value. Returns parsed JSON or null.
 */
export async function cacheGet(key) {
  try {
    const c = await getClient();
    if (!c) return null;
    const value = await c.get(key);
    return value ? JSON.parse(value) : null;
  } catch (err) {
    return null;
  }
}

/**
 * Set a cached value with TTL.
 */
export async function cacheSet(key, value, ttlSeconds = DEFAULT_TTL) {
  try {
    const c = await getClient();
    if (!c) return;
    await c.set(key, JSON.stringify(value), { EX: ttlSeconds });
  } catch (err) {
    // Silently fail — cache is non-critical
  }
}

/**
 * Invalidate all API caches. Call after ingestion or intelligence pipeline completes.
 */
export async function invalidateAll() {
  try {
    const c = await getClient();
    if (!c) return;
    const keys = await c.keys('api:*');
    if (keys.length > 0) {
      await c.del(keys);
      logger.info(`Cache invalidated: ${keys.length} keys`);
    }
  } catch (err) {
    logger.debug('Cache invalidation failed', { error: err.message });
  }
}

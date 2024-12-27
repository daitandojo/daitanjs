// caching.js

import NodeCache from 'node-cache';
import crypto from 'crypto';

/**
 * @class CacheManager
 * @description Manages caching for API responses, database queries, and computed results
 */
class CacheManager {
  constructor(options = {}) {
    this.cache = new NodeCache(options);
  }

  /**
   * Generates a cache key based on the provided arguments
   * @param {string} prefix - A prefix for the cache key
   * @param {*} args - Arguments to be included in the cache key
   * @returns {string} The generated cache key
   */
  generateKey(prefix, ...args) {
    const key = JSON.stringify(args);
    return `${prefix}:${crypto.createHash('md5').update(key).digest('hex')}`;
  }

  /**
   * Sets a value in the cache
   * @param {string} key - The cache key
   * @param {*} value - The value to be cached
   * @param {number} ttl - Time to live in seconds
   */
  set(key, value, ttl) {
    this.cache.set(key, value, ttl);
  }

  /**
   * Gets a value from the cache
   * @param {string} key - The cache key
   * @returns {*} The cached value or undefined if not found
   */
  get(key) {
    return this.cache.get(key);
  }

  /**
   * Deletes a value from the cache
   * @param {string} key - The cache key
   */
  del(key) {
    this.cache.del(key);
  }

  /**
   * Clears the entire cache
   */
  clear() {
    this.cache.flushAll();
  }

  /**
   * Wraps a function with caching logic
   * @param {Function} fn - The function to be cached
   * @param {Object} options - Caching options
   * @param {string} options.prefix - Prefix for the cache key
   * @param {number} options.ttl - Time to live in seconds
   * @returns {Function} The wrapped function with caching
   */
  wrap(fn, { prefix, ttl }) {
    return async (...args) => {
      const cacheKey = this.generateKey(prefix, ...args);
      const cachedResult = this.get(cacheKey);

      if (cachedResult !== undefined) {
        return cachedResult;
      }

      const result = await fn(...args);
      this.set(cacheKey, result, ttl);
      return result;
    };
  }

  /**
   * Invalidates cache entries based on a prefix
   * @param {string} prefix - The prefix of cache keys to invalidate
   */
  invalidateByPrefix(prefix) {
    const keys = this.cache.keys();
    const keysToDelete = keys.filter(key => key.startsWith(prefix));
    keysToDelete.forEach(key => this.cache.del(key));
  }
}

export default CacheManager;
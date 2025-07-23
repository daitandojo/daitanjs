// intelligence/src/caching/cacheManager.js
/**
 * @file Manages different types of caches (e.g., for LLM responses, embeddings) by leveraging the canonical CacheManager from @daitanjs/data.
 * @module @daitanjs/intelligence/caching/cacheManager
 */
import { getLogger } from '@daitanjs/development';
import { DaitanConfigurationError } from '@daitanjs/error';
import crypto from 'crypto';
import { CacheManager } from '@daitanjs/data';

const logger = getLogger('daitan-cache-manager');

/**
 * @typedef {import('@daitanjs/data').CacheManager} DaitanCacheManager
 */

/**
 * @typedef {Object} CacheConfig
 * @property {boolean} [enabled=false]
 * @property {number} [capacity=100]
 */

const globalCaches = {
  llmResponses: null,
  embeddings: null,
};

/**
 * Initializes and returns a named cache instance.
 * @param {'llmResponses' | 'embeddings'} cacheName
 * @param {CacheConfig} [config]
 * @returns {DaitanCacheManager | null}
 */
export const getCache = (cacheName, config = {}) => {
  const { enabled = false, capacity = 100 } = config;

  if (!globalCaches.hasOwnProperty(cacheName)) {
    logger.warn(
      `Cache name "${cacheName}" is not a recognized cache. No cache created.`
    );
    return null;
  }

  if (!enabled) {
    if (globalCaches[cacheName]) {
      globalCaches[cacheName].flushAll();
      globalCaches[cacheName] = null;
    }
    return null;
  }

  if (globalCaches[cacheName]) {
    const currentCapacity = globalCaches[cacheName].nodeCacheOptions.maxKeys;
    if (currentCapacity !== capacity && capacity > 0) {
      logger.warn(
        `Cache "${cacheName}" capacity changed from ${currentCapacity} to ${capacity}. Re-initializing.`
      );
      globalCaches[cacheName].flushAll();
      globalCaches[cacheName].close();
      globalCaches[cacheName] = null;
    } else {
      return globalCaches[cacheName];
    }
  }

  try {
    const cacheInstance = new CacheManager({ maxKeys: capacity }, logger);
    globalCaches[cacheName] = cacheInstance;
    return cacheInstance;
  } catch (error) {
    throw new DaitanConfigurationError(
      `Failed to create cache instance for "${cacheName}"`,
      {},
      error
    );
  }
};

/**
 * Generates a SHA256 hash for a given object or string to be used as a cache key.
 */
export const generateCacheKey = (object, prefix = '') => {
  const stableStringify = (obj) => {
    if (typeof obj !== 'object' || obj === null) return JSON.stringify(obj);
    if (Array.isArray(obj)) return JSON.stringify(obj.map(stableStringify));
    return JSON.stringify(
      Object.keys(obj)
        .sort()
        .reduce((acc, key) => {
          acc[key] = stableStringify(obj[key]);
          return acc;
        }, {})
    );
  };
  const stringToHash =
    typeof object === 'string' ? object : stableStringify(object);
  const hash = crypto.createHash('sha256').update(stringToHash).digest('hex');
  return prefix ? `${prefix}:${hash}` : hash;
};

/**
 * Clears a specific cache or all managed caches.
 */
export const clearCache = (cacheName = 'all') => {
  if (cacheName === 'all') {
    Object.keys(globalCaches).forEach((name) => {
      if (globalCaches[name]) {
        globalCaches[name].flushAll();
      }
    });
  } else if (globalCaches[cacheName]) {
    globalCaches[cacheName].flushAll();
  }
};

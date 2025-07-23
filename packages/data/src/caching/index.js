// data/src/caching/index.js
/**
 * @file CacheManager class for in-memory caching using `node-cache`.
 * @module @daitanjs/data/caching
 *
 * @description
 * This module exports the `CacheManager` class, which provides a wrapper around the
 * `node-cache` library. It facilitates caching of various data types such as API responses,
 * database query results, or computationally expensive results.
 *
 * Key Features:
 * - Simple API for `set`, `get`, `del`, and `flushAll`.
 * - Automatic key generation based on prefixes and arguments using MD5 hashing.
 * - Wrapper function `wrap` to easily add caching to existing asynchronous functions.
 * - Invalidation of cache entries by prefix.
 * - Optional detailed logging of cache events (SET, DEL, EXPIRED, FLUSH) if debug level is enabled.
 * - Configurable `node-cache` options (e.g., `stdTTL`, `checkperiod`) at instantiation.
 *
 * This cache is in-memory and process-specific. For distributed caching or persistence,
 * a different solution (e.g., Redis, Memcached) would be required.
 */
import NodeCache from 'node-cache';
import crypto from 'crypto'; // Node.js crypto module for hashing keys
import { getLogger } from '@daitanjs/development'; // Standardized logger
import { DaitanInvalidInputError, DaitanOperationError } from '@daitanjs/error'; // For error handling

const cacheManagerBaseLogger = getLogger('daitan-cache-manager'); // Base logger for the module

/**
 * @class CacheManager
 * @classdesc Manages in-memory caching for various data types using `node-cache`.
 *            Provides methods for setting, getting, deleting, and flushing cache entries,
 *            as well as utilities for key generation and wrapping functions with caching logic.
 */
class CacheManager {
  /**
   * Creates an instance of CacheManager.
   * @public
   * @param {object} [options={}] - Options for the underlying `node-cache` instance.
   *                                 Common options include:
   *                                 - `stdTTL` (number): Default Time-To-Live in seconds for new entries. 0 = infinite.
   *                                 - `checkperiod` (number): Interval in seconds for automatic expired key deletion. 0 = no check.
   *                                 - `useClones` (boolean): If true, clones values on set/get to prevent mutation. Default true.
   *                                 - `maxKeys` (number): Max number of keys in cache (-1 for unlimited).
   *                                 See `node-cache` documentation for all available options.
   * @param {import('winston').Logger} [loggerInstance] - Optional logger instance. If not provided, a default 'daitan-cache-manager' logger is used.
   *
   * @example
   * // Cache with default TTL of 1 hour, checking for expired keys every 10 minutes
   * const myCache = new CacheManager({ stdTTL: 3600, checkperiod: 600 });
   * // Cache with a maximum of 500 keys
   * const limitedCache = new CacheManager({ maxKeys: 500 });
   */
  constructor(options = {}, loggerInstance) {
    this.logger = loggerInstance || cacheManagerBaseLogger;
    this.nodeCacheOptions = {
      useClones: true, // Default to true for safety, prevents modification of cached objects by reference.
      deleteOnExpire: true,
      ...options, // User-provided options override defaults
    };

    try {
      this.cache = new NodeCache(this.nodeCacheOptions);
      this.logger.info('CacheManager initialized successfully.', {
        optionsUsed: this.nodeCacheOptions,
        instanceId: this.cache.id, // node-cache provides a unique ID for the instance
      });

      // Attach event listeners for detailed logging if debug level is enabled
      if (this.logger.isLevelEnabled('debug')) {
        this._attachDebugEventListeners();
      }
    } catch (error) {
      this.logger.error(
        'Failed to initialize NodeCache within CacheManager.',
        {
          errorMessage: error.message,
          optionsAttempted: this.nodeCacheOptions,
        },
        error // Pass full error object to logger
      );
      // Re-throw as a DaitanOperationError for consistent error handling upstream
      throw new DaitanOperationError(
        `CacheManager initialization failed: ${error.message}. Check NodeCache options.`,
        { options: this.nodeCacheOptions },
        error
      );
    }
  }

  /**
   * Attaches debug event listeners to the NodeCache instance.
   * @private
   */
  _attachDebugEventListeners() {
    this.cache.on('set', (key, value) => {
      this.logger.debug(`Cache Event: SET`, {
        key: this._previewKey(key),
        valuePreview: this._previewValue(value),
        ttl: this.cache.getTtl(key)
          ? (this.cache.getTtl(key) - Date.now()) / 1000 + 's'
          : 'default/infinite',
      });
    });
    this.cache.on('del', (key, value) => {
      this.logger.debug(`Cache Event: DEL`, { key: this._previewKey(key) });
    });
    this.cache.on('expired', (key, value) => {
      this.logger.debug(`Cache Event: EXPIRED`, {
        key: this._previewKey(key),
      });
    });
    this.cache.on('flush', () => {
      this.logger.info('Cache Event: FLUSH (all cache entries cleared).');
    });
    this.cache.on('flush_stats', () => {
      this.logger.info('Cache Event: FLUSH_STATS (cache statistics reset).');
    });
    this.logger.debug('Attached debug event listeners to NodeCache instance.');
  }

  /**
   * Generates a preview of a cache key for logging (truncated).
   * @private
   */
  _previewKey(key) {
    const keyStr = String(key);
    return keyStr.length > 70 ? keyStr.substring(0, 70) + '...' : keyStr;
  }

  /**
   * Generates a preview of a cached value for logging.
   * @private
   */
  _previewValue(value) {
    if (value === null || value === undefined) return String(value);
    if (typeof value === 'string') {
      return value.length > 50 ? value.substring(0, 50) + '...' : value;
    }
    if (typeof value === 'object') {
      return `{type: ${typeof value}, keys: ${Object.keys(value).length}}`;
    }
    return String(value).substring(0, 50);
  }

  /**
   * Generates a cache key from a prefix string and a variable number of arguments.
   * @public
   * @param {string} prefix - A prefix for the cache key (e.g., 'api:weather').
   * @param {...any} args - Arguments to be included in the cache key.
   * @returns {string} The generated cache key.
   * @throws {DaitanInvalidInputError} If `prefix` is not a non-empty string.
   */
  generateKey(prefix, ...args) {
    if (!prefix || typeof prefix !== 'string' || !prefix.trim()) {
      throw new DaitanInvalidInputError(
        'Cache key prefix must be a non-empty string.'
      );
    }
    try {
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
      const keyMaterial = stableStringify(args);
      const hash = crypto.createHash('md5').update(keyMaterial).digest('hex');
      return `${prefix.trim()}:${hash}`;
    } catch (error) {
      this.logger.error(
        'Error generating cache key from arguments. Using fallback.',
        { prefix, errorMessage: error.message }
      );
      return `${prefix.trim()}:${crypto
        .createHash('md5')
        .update(String(args))
        .digest('hex')}`;
    }
  }

  /**
   * Sets a value in the cache with an optional Time-To-Live (TTL) in seconds.
   * @public
   * @param {string} key - The cache key.
   * @param {any} value - The value to be cached.
   * @param {number} [ttlSeconds] - Time to live in seconds.
   * @returns {boolean} True if the item was successfully set.
   * @throws {DaitanInvalidInputError} If `key` is not a non-empty string.
   */
  set(key, value, ttlSeconds) {
    if (!key || typeof key !== 'string' || !key.trim()) {
      throw new DaitanInvalidInputError(
        'Cache key must be a non-empty string for set operation.'
      );
    }
    if (value === undefined) {
      this.logger.warn(
        `Attempted to set 'undefined' for key "${this._previewKey(
          key
        )}". Operation skipped.`
      );
      return false;
    }

    let success;
    if (
      ttlSeconds !== undefined &&
      typeof ttlSeconds === 'number' &&
      ttlSeconds > 0
    ) {
      success = this.cache.set(key, value, ttlSeconds);
    } else {
      success = this.cache.set(key, value);
    }

    if (!success) {
      this.logger.warn(
        `Cache SET operation failed for key: "${this._previewKey(
          key
        )}". NodeCache returned false.`
      );
    }
    return success;
  }

  /**
   * Gets a value from the cache.
   * @public
   * @param {string} key - The cache key.
   * @returns {any | undefined} The cached value, or `undefined` if not found.
   * @throws {DaitanInvalidInputError} If `key` is not a non-empty string.
   */
  get(key) {
    if (!key || typeof key !== 'string' || !key.trim()) {
      throw new DaitanInvalidInputError(
        'Cache key must be a non-empty string for get operation.'
      );
    }
    const value = this.cache.get(key);
    this.logger.debug(
      `Cache GET ${
        value !== undefined ? 'HIT' : 'MISS'
      } for key: "${this._previewKey(key)}".`
    );
    return value;
  }

  /**
   * Deletes one or more keys from the cache.
   * @public
   * @param {string | string[]} keys - A single key string or an array of key strings to delete.
   * @returns {number} The number of keys successfully deleted.
   * @throws {DaitanInvalidInputError} If `keys` argument is invalid.
   */
  del(keys) {
    if (
      !keys ||
      (typeof keys !== 'string' && !Array.isArray(keys)) ||
      (typeof keys === 'string' && !keys.trim()) ||
      (Array.isArray(keys) && keys.length === 0)
    ) {
      throw new DaitanInvalidInputError(
        'Keys for deletion must be a non-empty string or a non-empty array of strings.'
      );
    }
    const numDeleted = this.cache.del(keys);
    this.logger.debug(`Cache DEL: Deleted ${numDeleted} key(s).`);
    return numDeleted;
  }

  /**
   * Clears the entire cache.
   * @public
   */
  flushAll() {
    this.cache.flushAll();
  }

  /**
   * Wraps an asynchronous function with caching logic.
   * @public
   * @async
   * @param {Function} fnToWrap - The async function to be wrapped.
   * @param {object} options - Caching options.
   * @param {string} options.prefix - A unique prefix for generating cache keys.
   * @param {number} [options.ttlSeconds] - Optional TTL for cached results.
   * @returns {Function} A new async function that incorporates caching.
   * @throws {DaitanInvalidInputError} If `fnToWrap` is not a function or `prefix` is invalid.
   */
  wrap(fnToWrap, { prefix, ttlSeconds }) {
    if (typeof fnToWrap !== 'function') {
      throw new DaitanInvalidInputError('`fnToWrap` must be a function.');
    }
    if (!prefix || typeof prefix !== 'string' || !prefix.trim()) {
      throw new DaitanInvalidInputError(
        'A non-empty string `prefix` is required for wrapping.'
      );
    }

    const wrappedFn = async (...args) => {
      const cacheKey = this.generateKey(prefix, ...args);
      const cachedResult = this.get(cacheKey);

      if (cachedResult !== undefined) {
        this.logger.debug(
          `Cache WRAP HIT for prefix "${prefix}". Returning cached result.`
        );
        return cachedResult;
      }

      this.logger.debug(
        `Cache WRAP MISS for prefix "${prefix}". Executing original function.`
      );
      const result = await fnToWrap(...args);
      this.set(cacheKey, result, ttlSeconds);
      return result;
    };

    Object.defineProperty(wrappedFn, 'name', {
      value: `${fnToWrap.name || 'anonymousFn'}WrappedWithCache`,
      configurable: true,
    });

    return wrappedFn;
  }

  /**
   * Invalidates (deletes) all cache entries whose keys start with a given prefix.
   * @public
   * @param {string} prefixToInvalidate - The prefix of cache keys to invalidate.
   * @returns {number} The number of cache entries successfully invalidated.
   * @throws {DaitanInvalidInputError} If `prefixToInvalidate` is invalid.
   */
  invalidateByPrefix(prefixToInvalidate) {
    if (
      !prefixToInvalidate ||
      typeof prefixToInvalidate !== 'string' ||
      !prefixToInvalidate.trim()
    ) {
      throw new DaitanInvalidInputError(
        'Prefix for invalidation must be a non-empty string.'
      );
    }
    const keysInCache = this.cache.keys();
    const keysToDelete = keysInCache.filter((key) =>
      String(key).startsWith(`${prefixToInvalidate.trim()}:`)
    );
    return this.del(keysToDelete);
  }

  /**
   * Retrieves statistics from the underlying `node-cache` instance.
   * @public
   * @returns {NodeCache.Stats} Cache statistics object.
   */
  getStats() {
    return this.cache.getStats();
  }

  /**
   * Closes the cache instance and clears any internal timers.
   * @public
   */
  close() {
    this.cache.close();
    this.logger.info('CacheManager closed.');
  }
}

export default CacheManager;

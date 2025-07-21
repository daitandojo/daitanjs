// finance/src/prices/cache.js
/**
 * @file In-memory caching utility for financial data (exchange rates, stock prices).
 * @module @daitanjs/finance/prices/cache
 *
 * @description
 * This module provides a simple, non-persistent, in-memory cache for financial data.
 * It now uses the canonical `@daitanjs/data#CacheManager` to ensure a consistent and
 * robust caching strategy across the DaitanJS ecosystem.
 *
 * Key Features (delegated to CacheManager):
 * - `get(key)`: Retrieves a cached value.
 * - `set(key, value)`: Stores a value in the cache.
 * - `del(key)`: Deletes a specific entry from the cache.
 * - `clearAll()`: Clears all entries from the cache.
 * - `getCacheSize()`: Returns the number of items in the cache.
 *
 * Cache keys are typically composite strings representing the data type, date, and identifiers,
 * e.g., "YYYY-MM-DD-FROM_CURRENCY-TO_CURRENCY-exchange" or "YYYY-MM-DD-STOCK_SYMBOL-BASE_CURRENCY-stock".
 */
import { getLogger } from '@daitanjs/development';
import CacheManager from '@daitanjs/data/caching'; // Using the canonical CacheManager
import { DaitanInvalidInputError } from '@daitanjs/error';

const cacheLogger = getLogger('daitan-finance-prices-cache');

// Singleton instance of the canonical CacheManager, configured for financial data.
let financialDataCacheManager = null;

const getCacheManagerInstance = () => {
  if (!financialDataCacheManager) {
    // Configure with sensible defaults for financial data caching.
    // e.g., stdTTL of 1 day (86400s), check for expired keys every hour.
    financialDataCacheManager = new CacheManager(
      { stdTTL: 86400, checkperiod: 3600 },
      cacheLogger
    );
    cacheLogger.info('Initialized singleton CacheManager for financial data.');
  }
  return financialDataCacheManager;
};

/**
 * Retrieves a value (e.g., exchange rate, stock price) from the in-memory cache.
 *
 * @public
 * @param {string} key - The cache key.
 * @returns {number | null} The cached numerical value, or `null` if the key is not found or invalid.
 * @throws {DaitanInvalidInputError} If `key` is not a non-empty string.
 */
export function get(key) {
  const cacheManager = getCacheManagerInstance();
  // `get` in CacheManager throws on invalid key, but we can add a check for clarity.
  if (typeof key !== 'string' || !key.trim()) {
    throw new DaitanInvalidInputError(
      'Cache key must be a non-empty string for get operation.'
    );
  }
  const value = cacheManager.get(key.trim());
  // CacheManager returns `undefined` for a miss, so we convert to `null` for consistency with the old API.
  return value !== undefined ? value : null;
}

/**
 * Stores a numerical value (e.g., exchange rate, stock price) in the in-memory cache.
 *
 * @public
 * @param {string} key - The cache key.
 * @param {number} value - The numerical value to store.
 * @param {number} [ttlSeconds] - Optional: Time-to-live in seconds for this specific entry.
 * @returns {void}
 * @throws {DaitanInvalidInputError} If `key` is invalid or if `value` is not a finite number.
 */
export function set(key, value, ttlSeconds) {
  const cacheManager = getCacheManagerInstance();
  if (typeof value !== 'number' || !isFinite(value)) {
    throw new DaitanInvalidInputError(
      `Cache value for key "${key}" must be a finite number. Received: ${value} (type: ${typeof value})`
    );
  }
  // The underlying CacheManager.set will throw DaitanInvalidInputError for an invalid key.
  cacheManager.set(key.trim(), value, ttlSeconds);
}

/**
 * Deletes a specific entry from the financial data cache by its key.
 *
 * @public
 * @param {string} key - The cache key of the entry to delete.
 * @returns {boolean} `true` if an element was deleted, `false` otherwise.
 * @throws {DaitanInvalidInputError} If `key` is not a non-empty string.
 */
export function del(key) {
  const cacheManager = getCacheManagerInstance();
  // The underlying CacheManager.del will throw on invalid key.
  const numDeleted = cacheManager.del(key.trim());
  return numDeleted > 0;
}

/**
 * Clears all entries from the in-memory financial data cache.
 *
 * @public
 * @returns {void}
 */
export function clearAll() {
  const cacheManager = getCacheManagerInstance();
  cacheManager.flushAll();
}

/**
 * Gets the current number of items in the cache.
 * @public
 * @returns {number} The number of items in the cache.
 */
export function getCacheSize() {
  const cacheManager = getCacheManagerInstance();
  return cacheManager.getStats().keys;
}

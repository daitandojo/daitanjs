// ./utils/cache.js

const exchangeRateCache = {};

/**
 * Retrieves the exchange rate from the cache.
 * @param {string} key - The cache key (e.g., `${date}-${currency}`).
 * @returns {number|null} - The cached exchange rate or null if not found.
 */
export function get(key) {
    return exchangeRateCache[key] || null;
}

/**
 * Stores the exchange rate in the cache.
 * @param {string} key - The cache key.
 * @param {number} rate - The exchange rate to store.
 */
export function set(key, rate) {
    exchangeRateCache[key] = rate;
}

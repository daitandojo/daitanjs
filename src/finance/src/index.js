// finance/src/index.js
/**
 * @file Main entry point for the @daitanjs/finance package.
 * @module @daitanjs/finance
 *
 * @description
 * This package provides utilities for fetching and working with financial data.
 * Currently, it focuses on retrieving historical exchange rates and stock prices
 * from external APIs.
 *
 * Core Functionalities (from `./prices/index.js`):
 * - **`getPrice(identifier, dateDMY, baseCurrency)`**: A versatile function that intelligently
 *   fetches either an exchange rate (if `identifier` is a currency code) or a stock price
 *   (if `identifier` is a stock symbol) for a given date, expressed in a `baseCurrency`.
 * - **`getExchangeRate(targetCurrency, dateDMY, baseCurrency)`**: Specifically fetches
 *   historical exchange rates using the Frankfurter.app API.
 * - **`getStockPrice(stockSymbol, dateDMY, baseCurrency)`**: Specifically fetches
 *   historical daily stock prices using the Alpha Vantage API, with currency conversion
 *   capabilities.
 *
 * Features:
 * - Integration with external financial data APIs (Frankfurter.app, Alpha Vantage).
 * - Simple in-memory caching for retrieved data to reduce API call frequency.
 * - Standardized error handling using DaitanJS custom error types.
 * - Configuration management for API keys (e.g., `ALPHAVANTAGE_API_KEY`) via
 *   `@daitanjs/config` (ConfigManager).
 * - Logging via `@daitanjs/development`.
 *
 * Future enhancements could include support for more financial data types (e.g.,
 * cryptocurrency prices, commodity prices, financial news), additional data providers,
 * and more advanced caching or data analysis tools.
 */

import { getLogger } from '@daitanjs/development';

const financeIndexLogger = getLogger('daitan-finance-index');

financeIndexLogger.debug(
  'Exporting DaitanJS Finance module functionalities...'
);

// --- Price Retrieval Functions ---
// These functions are the primary public API of this package.
// JSDoc for these functions is located in `src/prices/index.js`.
export { getPrice, getExchangeRate, getStockPrice } from './prices/index.js';

// --- Cache Management (Optional Export) ---
// If consumers need direct control over the financial data cache (e.g., to clear it).
// JSDoc for these cache functions is in `src/prices/cache.js`.
export {
  get as getFromPriceCache, // Aliased to avoid generic 'get'
  set as setToPriceCache, // Aliased
  del as deleteFromPriceCache, // Aliased
  clearAll as clearAllPriceCache, // Aliased
  getCacheSize as getPriceCacheSize, // Aliased
} from './prices/cache.js';

financeIndexLogger.info(
  'DaitanJS Finance module exports configured and ready.'
);

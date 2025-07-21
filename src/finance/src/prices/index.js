// src/finance/src/prices/index.js
/**
 * @file Provides functions to fetch exchange rates and stock prices from external APIs.
 * @module @daitanjs/finance/prices
 */
import { query as apiQuery } from '@daitanjs/apiqueries';
import { getLogger } from '@daitanjs/development';
import { getConfigManager } from '@daitanjs/config';
import {
  DaitanApiError,
  DaitanConfigurationError,
  DaitanNotFoundError,
  DaitanOperationError,
  DaitanInvalidInputError,
  DaitanError,
} from '@daitanjs/error';
import { get as getFromCache, set as setToCache } from './cache.js';

const pricesLogger = getLogger('daitan-finance-prices');

const FRANKFURTER_API_URL = 'https://api.frankfurter.app';
const ALPHAVANTAGE_STOCK_API_URL = 'https://www.alphavantage.co/query';

const COMMON_CURRENCIES_ISO_A3 = [
  'USD',
  'EUR',
  'JPY',
  'GBP',
  'AUD',
  'CAD',
  'CHF',
  'CNY',
  'HKD',
  'NZD',
  'SEK',
  'KRW',
  'SGD',
  'NOK',
  'MXN',
  'INR',
  'RUB',
  'ZAR',
  'TRY',
  'BRL',
  'DKK',
  'PLN',
  'THB',
  'IDR',
  'HUF',
  'CZK',
  'ILS',
  'CLP',
  'PHP',
  'AED',
  'COP',
  'SAR',
  'MYR',
  'RON',
];

/** @private */
const isValidDmyDate = (dateDMYStr) =>
  /^\d{2}\/\d{2}\/\d{4}$/.test(dateDMYStr) &&
  new Date(dateDMYStr.split('/').reverse().join('-')).getDate() ===
    parseInt(dateDMYStr.split('/')[0], 10);
/** @private */
const isValidCurrencyCode = (code) =>
  typeof code === 'string' && /^[A-Z]{3}$/.test(code.toUpperCase().trim());

/**
 * Retrieves the price for a given financial identifier (currency or stock symbol).
 * @public @async
 * @param {{identifier: string, dateDMY: string, baseCurrency: string}} params
 * @returns {Promise<number>}
 */
export async function getPrice({ identifier, dateDMY, baseCurrency }) {
  if (!identifier || typeof identifier !== 'string')
    throw new DaitanInvalidInputError(
      'Identifier (currency or stock symbol) must be a string.'
    );
  if (!isValidDmyDate(dateDMY))
    throw new DaitanInvalidInputError(
      'Date must be a valid date in DD/MM/YYYY format.'
    );
  if (!isValidCurrencyCode(baseCurrency))
    throw new DaitanInvalidInputError(
      'Base currency must be a valid 3-letter ISO code.'
    );

  const upperIdentifier = identifier.toUpperCase().trim();
  const upperBaseCurrency = baseCurrency.toUpperCase().trim();

  if (COMMON_CURRENCIES_ISO_A3.includes(upperIdentifier)) {
    return getExchangeRate({
      targetCurrency: upperIdentifier,
      dateDMY,
      baseCurrency: upperBaseCurrency,
    });
  } else {
    return getStockPrice({
      stockSymbol: upperIdentifier,
      dateDMY,
      baseCurrency: upperBaseCurrency,
    });
  }
}

/**
 * Retrieves the historical exchange rate for a target currency against a base currency.
 * @public @async
 * @param {{targetCurrency: string, dateDMY: string, baseCurrency: string}} params
 * @returns {Promise<number>} The exchange rate.
 */
export async function getExchangeRate({
  targetCurrency,
  dateDMY,
  baseCurrency,
}) {
  const upperTargetCurrency = String(targetCurrency).toUpperCase().trim();
  const upperBaseCurrency = String(baseCurrency).toUpperCase().trim();

  if (!isValidCurrencyCode(upperTargetCurrency))
    throw new DaitanInvalidInputError(
      'Target currency must be a 3-letter ISO code.'
    );
  if (!isValidCurrencyCode(upperBaseCurrency))
    throw new DaitanInvalidInputError(
      'Base currency must be a 3-letter ISO code.'
    );
  if (!isValidDmyDate(dateDMY))
    throw new DaitanInvalidInputError(
      'Date must be a valid date in DD/MM/YYYY format.'
    );

  if (upperTargetCurrency === upperBaseCurrency) return 1.0;

  const dateYMD = dateDMY.split('/').reverse().join('-');
  const cacheKey = `${dateYMD}-${upperTargetCurrency}-${upperBaseCurrency}-exchange`;
  const cachedRate = getFromCache(cacheKey);
  if (cachedRate !== null) return cachedRate;

  try {
    const responseData = await apiQuery({
      url: `${FRANKFURTER_API_URL}/${dateYMD}`,
      params: { from: upperTargetCurrency, to: upperBaseCurrency },
    });
    const rate = responseData?.rates?.[upperBaseCurrency];
    if (typeof rate !== 'number')
      throw new DaitanNotFoundError(
        `Exchange rate for ${dateYMD} from ${upperTargetCurrency} to ${upperBaseCurrency} not found.`
      );
    setToCache(cacheKey, rate);
    return rate;
  } catch (error) {
    if (error instanceof DaitanError) throw error;
    throw new DaitanOperationError(
      `Failed to fetch exchange rate: ${error.message}`,
      { targetCurrency, baseCurrency, dateDMY },
      error
    );
  }
}

/**
 * Retrieves the historical closing stock price for a given symbol on a specific date.
 * @public @async
 * @param {{stockSymbol: string, dateDMY: string, baseCurrency: string}} params
 * @returns {Promise<number>} The stock price in the specified `baseCurrency`.
 */
export async function getStockPrice({ stockSymbol, dateDMY, baseCurrency }) {
  const configManager = getConfigManager(); // Lazy-load
  const ALPHAVANTAGE_API_KEY_CACHE = configManager.get('ALPHAVANTAGE_API_KEY');

  if (!ALPHAVANTAGE_API_KEY_CACHE) {
    pricesLogger.warn(
      'ALPHAVANTAGE_API_KEY is not configured. Stock price functionality will be unavailable.'
    );
    throw new DaitanConfigurationError(
      'Alpha Vantage API key (ALPHAVANTAGE_API_KEY) is not configured.'
    );
  }

  if (!stockSymbol || typeof stockSymbol !== 'string')
    throw new DaitanInvalidInputError(
      'Stock symbol must be a non-empty string.'
    );
  if (!isValidDmyDate(dateDMY))
    throw new DaitanInvalidInputError(
      'Date must be a valid date in DD/MM/YYYY format.'
    );
  if (!isValidCurrencyCode(baseCurrency))
    throw new DaitanInvalidInputError(
      'Base currency must be a 3-letter ISO code.'
    );

  const upperStockSymbol = stockSymbol.toUpperCase().trim();
  const upperBaseCurrency = baseCurrency.toUpperCase().trim();
  const dateYMD = dateDMY.split('/').reverse().join('-');
  const cacheKey = `${dateYMD}-stock-${upperStockSymbol}-${upperBaseCurrency}`;
  const cachedPrice = getFromCache(cacheKey);
  if (cachedPrice !== null) return cachedPrice;

  try {
    const stockData = await apiQuery({
      url: ALPHAVANTAGE_STOCK_API_URL,
      params: {
        function: 'TIME_SERIES_DAILY',
        symbol: upperStockSymbol,
        apikey: ALPHAVANTAGE_API_KEY_CACHE,
      },
    });
    if (stockData['Error Message'])
      throw new DaitanApiError(
        `Alpha Vantage API error: ${stockData['Error Message']}`,
        'AlphaVantage'
      );
    if (stockData['Note'])
      throw new DaitanApiError(`Alpha Vantage API Note: ${stockData['Note']}`, {
        apiName: 'AlphaVantage',
      });

    const dailyData = stockData['Time Series (Daily)']?.[dateYMD];
    if (!dailyData?.['4. close'])
      throw new DaitanNotFoundError(
        `Stock price for ${upperStockSymbol} on ${dateYMD} not found.`
      );

    const stockPriceInUSD = parseFloat(dailyData['4. close']);
    if (isNaN(stockPriceInUSD))
      throw new DaitanOperationError(
        'Received invalid stock price data from Alpha Vantage.'
      );

    let finalPrice = stockPriceInUSD;
    if (upperBaseCurrency !== 'USD') {
      const rate = await getExchangeRate({
        targetCurrency: 'USD',
        dateDMY,
        baseCurrency: upperBaseCurrency,
      });
      finalPrice = stockPriceInUSD * rate;
    }

    const roundedPrice = Number(finalPrice.toFixed(4));
    setToCache(cacheKey, roundedPrice);
    return roundedPrice;
  } catch (error) {
    if (error instanceof DaitanError) throw error;
    throw new DaitanOperationError(
      `Failed to get stock price for ${upperStockSymbol}: ${error.message}`,
      { stockSymbol, dateDMY, baseCurrency },
      error
    );
  }
}

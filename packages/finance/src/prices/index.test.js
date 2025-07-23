// src/finance/src/prices/index.test.js
import { query as apiQuery } from '@daitanjs/apiqueries';
import { getPrice, getExchangeRate, getStockPrice } from './index.js';
import { clearAll as clearPriceCache } from './cache.js';
import {
  DaitanInvalidInputError,
  DaitanApiError,
  DaitanNotFoundError,
  DaitanConfigurationError,
} from '@daitanjs/error';
import { getConfigManager } from '@daitanjs/config';
import * as cacheModule from './cache.js';

// Mock dependencies
jest.mock('@daitanjs/apiqueries');
jest.mock('@daitanjs/development', () => ({
  getLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));
jest.mock('@daitanjs/config', () => ({
  getConfigManager: () => ({
    get: (key) => {
      if (key === 'ALPHAVANTAGE_API_KEY') return 'DUMMY_AV_KEY';
      return undefined;
    },
  }),
}));

const getFromCacheSpy = jest.spyOn(cacheModule, 'get');
const setToCacheSpy = jest.spyOn(cacheModule, 'set');

describe('@daitanjs/finance/prices', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearPriceCache();
    getFromCacheSpy.mockClear();
    setToCacheSpy.mockClear();
  });

  describe('getExchangeRate', () => {
    it('should fetch and return an exchange rate', async () => {
      const mockApiResponse = { rates: { EUR: 0.945 } };
      apiQuery.mockResolvedValue(mockApiResponse);
      const rate = await getExchangeRate({
        targetCurrency: 'USD',
        dateDMY: '27/10/2023',
        baseCurrency: 'EUR',
      });
      expect(apiQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://api.frankfurter.app/2023-10-27',
          params: { from: 'USD', to: 'EUR' },
        })
      );
      expect(rate).toBe(0.945);
    });

    it('should return 1.0 if currencies are the same', async () => {
      const rate = await getExchangeRate({
        targetCurrency: 'USD',
        dateDMY: '27/10/2023',
        baseCurrency: 'USD',
      });
      expect(rate).toBe(1.0);
      expect(apiQuery).not.toHaveBeenCalled();
    });

    it('should throw DaitanNotFoundError if rate is not in the response', async () => {
      apiQuery.mockResolvedValue({ rates: { JPY: 150.0 } });
      await expect(
        getExchangeRate({
          targetCurrency: 'USD',
          dateDMY: '27/10/2023',
          baseCurrency: 'EUR',
        })
      ).rejects.toThrow(DaitanNotFoundError);
    });
  });

  describe('getStockPrice', () => {
    const mockStockResponse = {
      'Time Series (Daily)': { '2023-10-27': { '4. close': '168.2200' } },
    };

    it('should fetch and return a stock price in USD', async () => {
      apiQuery.mockResolvedValue(mockStockResponse);
      const price = await getStockPrice({
        stockSymbol: 'AAPL',
        dateDMY: '27/10/2023',
        baseCurrency: 'USD',
      });
      expect(apiQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          params: expect.objectContaining({ symbol: 'AAPL' }),
        })
      );
      expect(price).toBe(168.22);
    });

    it('should convert the stock price to a non-USD currency', async () => {
      apiQuery.mockResolvedValueOnce(mockStockResponse);
      apiQuery.mockResolvedValueOnce({ rates: { EUR: 0.95 } });
      const price = await getStockPrice({
        stockSymbol: 'AAPL',
        dateDMY: '27/10/2023',
        baseCurrency: 'EUR',
      });
      expect(apiQuery).toHaveBeenCalledTimes(2);
      expect(price).toBeCloseTo(168.22 * 0.95);
    });
  });

  describe('getPrice (dispatcher)', () => {
    it('should call getExchangeRate for a known currency identifier', async () => {
      apiQuery.mockResolvedValue({ rates: { JPY: 150.5 } });
      const price = await getPrice({
        identifier: 'EUR',
        dateDMY: '27/10/2023',
        baseCurrency: 'JPY',
      });
      expect(apiQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('frankfurter.app'),
          params: { from: 'EUR', to: 'JPY' },
        })
      );
      expect(price).toBe(150.5);
    });

    it('should call getStockPrice for a non-currency identifier', async () => {
      const mockStockResponse = {
        'Time Series (Daily)': { '2023-10-27': { '4. close': '200.00' } },
      };
      apiQuery.mockResolvedValue(mockStockResponse);
      const price = await getPrice({
        identifier: 'MSFT',
        dateDMY: '27/10/2023',
        baseCurrency: 'USD',
      });
      expect(apiQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('alphavantage.co'),
          params: expect.objectContaining({ symbol: 'MSFT' }),
        })
      );
      expect(price).toBe(200.0);
    });
  });
});

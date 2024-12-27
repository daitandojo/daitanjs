import axios from 'axios';
import { get, set } from './cache.js';

import dotenv from 'dotenv';
dotenv.config({ path: path.resolve('/home/mark/Repos/.env') });

const API_URL = 'https://api.frankfurter.app';
const ALPHAVANTAGE_STOCK_API_URL = 'https://www.alphavantage.co/query';
const ALPHAVANTAGE_STOCK_API_KEY = process.env.ALPHAVANTAGE_STOCK_API_KEY;

const CURRENCIES = ['EUR', 'GBP', 'JPY', 'DKK', 'SEK', 'USD', 'AUD', 'CAD', 'CHF', 'CNY', 'NZD', 'INR'];

export async function getPrice(identifier, dateDMY, baseCurrency) {
    return CURRENCIES.includes(identifier)
        ? getExchangeRate(identifier, dateDMY, baseCurrency)
        : getStockPrice(identifier, dateDMY, baseCurrency);
}

export async function getExchangeRate(identifier, dateDMY, baseCurrency) {
    if (identifier === baseCurrency) return 1;

    const cacheKey = `${dateDMY}-${identifier}-${baseCurrency}`;
    const cachedRate = get(cacheKey);
    if (cachedRate) return cachedRate;

    const dateYMD = dateDMY.split('/').reverse().join('-');
    const response = await axios.get(`${API_URL}/${dateYMD}`, { params: { from: identifier, to: baseCurrency } });
    const rate = response.data.rates[baseCurrency];

    if (!rate) throw new Error(`Exchange rate not found for ${dateDMY}`);

    set(cacheKey, rate);
    return rate;
}

export async function getStockPrice(identifier, dateDMY, baseCurrency) {
    const cacheKey = `${dateDMY}-stock-${identifier}-${baseCurrency}`;
    const cachedPrice = get(cacheKey);
    if (cachedPrice) return cachedPrice;

    const dateYMD = dateDMY.split('/').reverse().join('-');
    const { data } = await axios.get(ALPHAVANTAGE_STOCK_API_URL, {
        params: {
            function: 'TIME_SERIES_DAILY',
            symbol: identifier,
            apikey: ALPHAVANTAGE_STOCK_API_KEY
        }
    });

    const stockPrice = parseFloat(data['Time Series (Daily)']?.[dateYMD]?.['4. close']);
    if (!stockPrice) throw new Error(`Stock price not found for ${dateDMY}`);

    const exchangeRate = await getExchangeRate('USD', dateDMY, baseCurrency);
    const convertedPrice = stockPrice * exchangeRate;

    set(cacheKey, convertedPrice);
    return convertedPrice;
}

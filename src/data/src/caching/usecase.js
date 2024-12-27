// usecase.js

import CacheManager from './caching.js';
import axios from 'axios';

// Create a new instance of CacheManager
const cacheManager = new CacheManager({ stdTTL: 600, checkperiod: 120 });

/**
 * Simulates a database query
 * @param {number} userId - The user ID to query
 * @returns {Promise<Object>} The user data
 */
async function fetchUserFromDatabase(userId) {
  // Simulate database query delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  return { id: userId, name: `User ${userId}`, email: `user${userId}@example.com` };
}

// Wrap the database query function with caching
const cachedFetchUser = cacheManager.wrap(fetchUserFromDatabase, {
  prefix: 'user',
  ttl: 3600 // Cache for 1 hour
});

/**
 * Fetches weather data from an API
 * @param {string} city - The city to fetch weather for
 * @returns {Promise<Object>} The weather data
 */
async function fetchWeatherData(city) {
  const response = await axios.get(`https://api.weatherapi.com/v1/current.json?key=YOUR_API_KEY&q=${city}`);
  return response.data;
}

// Wrap the API call function with caching
const cachedFetchWeather = cacheManager.wrap(fetchWeatherData, {
  prefix: 'weather',
  ttl: 1800 // Cache for 30 minutes
});

/**
 * Computes a factorial
 * @param {number} n - The number to compute factorial for
 * @returns {number} The factorial of n
 */
function computeFactorial(n) {
  if (n === 0 || n === 1) return 1;
  return n * computeFactorial(n - 1);
}

// Wrap the computation function with caching
const cachedComputeFactorial = cacheManager.wrap(computeFactorial, {
  prefix: 'factorial',
  ttl: 86400 // Cache for 24 hours
});

// Usage examples
async function main() {
  console.time('First user fetch');
  const user1 = await cachedFetchUser(1);
  console.timeEnd('First user fetch');
  console.log('User 1:', user1);

  console.time('Second user fetch (cached)');
  const user1Cached = await cachedFetchUser(1);
  console.timeEnd('Second user fetch (cached)');
  console.log('User 1 (cached):', user1Cached);

  console.time('Weather fetch');
  const londonWeather = await cachedFetchWeather('London');
  console.timeEnd('Weather fetch');
  console.log('London weather:', londonWeather);

  console.time('Factorial computation');
  const factorial20 = await cachedComputeFactorial(20);
  console.timeEnd('Factorial computation');
  console.log('Factorial of 20:', factorial20);

  console.time('Factorial computation (cached)');
  const factorial20Cached = await cachedComputeFactorial(20);
  console.timeEnd('Factorial computation (cached)');
  console.log('Factorial of 20 (cached):', factorial20Cached);

  // Invalidate weather cache
  cacheManager.invalidateByPrefix('weather');
  console.log('Weather cache invalidated');

  console.time('Weather fetch after invalidation');
  const londonWeatherNew = await cachedFetchWeather('London');
  console.timeEnd('Weather fetch after invalidation');
  console.log('London weather (new):', londonWeatherNew);
}

main().catch(console.error);
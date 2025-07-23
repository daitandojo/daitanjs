// utilities/src/async/timeout.js
/**
 * @file Provides an async timeout utility.
 * @module @daitanjs/utilities/async/timeout
 */
import { DaitanOperationError } from '@daitanjs/error';

/**
 * Wraps a promise with a timeout. If the promise does not resolve or reject
 * within the specified time, it will reject with a timeout error.
 *
 * @param {Promise<T>} promise - The promise to wrap.
 * @template T
 * @param {number} timeoutMs - The timeout duration in milliseconds.
 * @param {string} [timeoutMessage='Operation timed out'] - Custom timeout error message.
 * @returns {Promise<T>} A new promise that will either resolve with the original promise's result
 *          or reject with a timeout error.
 */
export const withTimeout = (
  promise,
  timeoutMs,
  timeoutMessage = 'Operation timed out'
) => {
  let timeoutId;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new DaitanOperationError(timeoutMessage, { code: 'TIMEOUT' }));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
};
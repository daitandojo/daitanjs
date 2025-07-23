// web/src/scraping/htmlFetch.js
/**
 * @file Contains the logic for fetching HTML content with timeouts.
 * @module @daitanjs/web/scraping/htmlFetch
 * @private
 */
import nodeFetch from 'node-fetch';
import { DaitanScrapingError } from '@daitanjs/error';

/**
 * Fetches HTML content from a URL with a specified timeout.
 * @param {string} url - The URL to fetch.
 * @param {number} timeout - Timeout in milliseconds.
 * @param {import('winston').Logger} logger - Logger instance.
 * @returns {Promise<string>} The HTML content as a string.
 */
export const fetchHtmlWithTimeout = async (url, timeout, logger) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    logger.warn(`Fetch timeout for ${url} after ${timeout}ms.`);
    controller.abort();
  }, timeout);

  try {
    const response = await nodeFetch(url, {
      // @ts-ignore
      signal: controller.signal,
      timeout: timeout + 1000,
    });
    clearTimeout(timeoutId);
    if (!response.ok) {
      throw new DaitanScrapingError(
        `HTTP error ${response.status} for ${url}. Status: ${response.statusText}`,
        { url, status: response.status, statusText: response.statusText }
      );
    }
    return await response.text();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError' || error.type === 'request-timeout') {
      throw new DaitanScrapingError(
        `Fetch aborted for ${url} (likely timeout after ${timeout}ms).`,
        { url },
        error
      );
    }
    if (error instanceof DaitanScrapingError) throw error;
    throw new DaitanScrapingError(
      `Fetch failed for ${url}: ${error.message}`,
      { url },
      error
    );
  }
};

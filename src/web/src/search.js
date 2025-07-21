// web/src/search.js
/**
 * @file Google Custom Search Engine (CSE) utilities.
 * @module @daitanjs/web/search
 *
 * @description
 * This module provides a function to perform searches using the Google Custom Search API.
 * It requires an API key and CX ID configuration. Results can be filtered by site or file type,
 * with an additional intelligent filter to isolate standard web pages.
 *
 * Configuration:
 * - `GOOGLE_API_KEY_SEARCH`: Google API Key for Custom Search.
 * - `GOOGLE_CSE_ID`: Your Custom Search Engine ID.
 * These are managed via `@daitanjs/config` (ConfigManager).
 */
import { getLogger } from '@daitanjs/development';
import { getConfigManager } from '@daitanjs/config';
import {
  DaitanApiError,
  DaitanConfigurationError,
  DaitanInvalidInputError,
} from '@daitanjs/error';
import { query as apiQuery } from '@daitanjs/apiqueries';
import { isValidURL } from '@daitanjs/validation';
import { truncateString } from '@daitanjs/utilities';
import path from 'path';

const logger = getLogger('daitan-web-search');

const GOOGLE_CSE_API_ENDPOINT = 'https://www.googleapis.com/customsearch/v1';

let googleApiKeyCache = null;
let googleCseIdCache = null;

/**
 * Initializes and caches Google Search configuration.
 * @private
 */
function initializeGoogleSearchConfig() {
  const configManager = getConfigManager();
  if (googleApiKeyCache && googleCseIdCache) return;

  googleApiKeyCache = configManager.get('GOOGLE_API_KEY_SEARCH');
  googleCseIdCache = configManager.get('GOOGLE_CSE_ID');

  if (!googleApiKeyCache) {
    logger.warn(
      'Google API Key (GOOGLE_API_KEY_SEARCH) is not configured. Google Custom Search will be unavailable.'
    );
  }
  if (!googleCseIdCache) {
    logger.warn(
      'Google Custom Search Engine ID (GOOGLE_CSE_ID) is not configured. Google Custom Search will be unavailable.'
    );
  }
}

/**
 * Checks if a link likely points to a standard web page (HTML).
 * @private
 */
const isWebPageLink = (link) => {
  if (!link || typeof link !== 'string' || !isValidURL(link)) {
    return false;
  }
  try {
    const parsedUrl = new URL(link);
    const pathname = parsedUrl.pathname;
    const extension = path.extname(pathname).toLowerCase();

    // List of common non-webpage file extensions to filter out.
    const excludedExtensions = [
      '.pdf',
      '.doc',
      '.docx',
      '.xls',
      '.xlsx',
      '.ppt',
      '.pptx',
      '.txt',
      '.csv',
      '.xml',
      '.json',
      '.rtf',
      '.zip',
      '.rar',
      '.tar',
      '.gz',
      '.7z',
      '.jpg',
      '.jpeg',
      '.png',
      '.gif',
      '.bmp',
      '.svg',
      '.webp',
      '.ico',
      '.mp3',
      '.wav',
      '.ogg',
      '.aac',
      '.flac',
      '.mp4',
      '.mov',
      '.avi',
      '.wmv',
      '.flv',
      '.mkv',
      '.webm',
      '.exe',
      '.dmg',
      '.apk',
      '.app',
      '.deb',
      '.rpm',
      '.iso',
      '.img',
      '.psd',
      '.ai',
      '.eps',
      '.key',
      '.numbers',
      '.pages',
      '.torrent',
    ];

    return !excludedExtensions.includes(extension);
  } catch (e) {
    logger.warn(
      `isWebPageLink: Error parsing URL "${link}" after initial validation. Error: ${e.message}`
    );
    return false;
  }
};

/**
 * @typedef {Object} GoogleSearchResultItem
 * @property {string} title - The title of the search result.
 * @property {string} link - The URL of the search result.
 * @property {string} snippet - A snippet of text from the result.
 * @property {string} [displayLink] - The displayed URL.
 * @property {object} [pagemap] - Rich metadata associated with the page (if available).
 */

/**
 * Performs a Google Custom Search.
 *
 * @public
 * @async
 * @param {object} params - Parameters for the search.
 * @param {string} params.query - The search query string.
 * @param {number} [params.num=5] - Number of search results to request (1-10).
 * @param {boolean} [params.filterWebpagesOnly=true] - If true, filters out direct links to files (PDFs, images, etc.).
 * @param {string} [params.siteSearch] - Restrict search to a specific site.
 * @param {string} [params.fileType] - Restrict results to a specific fileType.
 * @param {string} [params.exactTerms] - Search for an exact phrase.
 * @param {string} [params.excludeTerms] - Exclude pages with these terms.
 * @param {string} [params.dateRestrict] - Restrict results by date.
 * @param {string} [params.lr] - Language restriction.
 * @param {string} [params.cr] - Country restriction.
 * @param {object} [params.otherApiParams] - Other valid Google CSE API parameters.
 * @returns {Promise<GoogleSearchResultItem[]>} An array of search result objects.
 */
export const googleSearch = async ({
  query,
  num = 5,
  filterWebpagesOnly = true,
  siteSearch,
  fileType,
  exactTerms,
  excludeTerms,
  dateRestrict,
  lr,
  cr,
  ...otherApiParams
}) => {
  const callId = `googleSearch-${Date.now().toString(36)}`;
  logger.info(`[${callId}] googleSearch: Initiated.`, {
    queryPreview: truncateString(query, 50),
    num_requested: num,
  });

  initializeGoogleSearchConfig();

  if (!googleApiKeyCache || !googleCseIdCache) {
    throw new DaitanConfigurationError(
      'Google Custom Search API Key (GOOGLE_API_KEY_SEARCH) and/or CX ID (GOOGLE_CSE_ID) are not configured.'
    );
  }
  if (!query || typeof query !== 'string' || !query.trim()) {
    throw new DaitanInvalidInputError(
      'Search query must be a non-empty string.'
    );
  }
  const numResults = Math.min(Math.max(1, num), 10);

  const queryParams = {
    key: googleApiKeyCache,
    cx: googleCseIdCache,
    q: query,
    num: numResults,
    ...(siteSearch && { siteSearch }),
    ...(fileType && { fileType }),
    ...(exactTerms && { exactTerms }),
    ...(excludeTerms && { excludeTerms }),
    ...(dateRestrict && { dateRestrict }),
    ...(lr && { lr }),
    ...(cr && { cr }),
    ...otherApiParams,
  };

  try {
    const responseData = await apiQuery({
      url: GOOGLE_CSE_API_ENDPOINT,
      params: queryParams,
      summary: `Google Custom Search for: "${truncateString(query, 30)}"`,
    });

    if (!responseData?.items || !Array.isArray(responseData.items)) {
      logger.warn(
        `[${callId}] Google Custom Search returned no 'items' array.`,
        {
          responseDataPreview: truncateString(
            JSON.stringify(responseData),
            200
          ),
        }
      );
      return [];
    }

    let finalResults = responseData.items.map((item) => ({
      title: item.title,
      link: item.link,
      snippet: item.snippet,
      displayLink: item.displayLink,
      pagemap: item.pagemap,
    }));

    if (filterWebpagesOnly) {
      const initialCount = finalResults.length;
      finalResults = finalResults.filter((item) => isWebPageLink(item.link));
      if (finalResults.length < initialCount) {
        logger.debug(
          `[${callId}] Filtered out ${
            initialCount - finalResults.length
          } non-webpage links.`
        );
      }
    }

    logger.info(
      `[${callId}] Retrieved ${finalResults.length} Google Custom Search results for: "${query}".`
    );
    return finalResults;
  } catch (error) {
    logger.error(
      `[${callId}] Error during Google Custom Search for "${query}": ${error.message}`,
      { errorName: error.name, queryParamsUsed: { ...queryParams, key: '***' } }
    );
    if (error instanceof DaitanError) throw error;
    throw new DaitanApiError(
      `Google Custom Search failed: ${error.message}`,
      'Google Custom Search API',
      error.response?.status || error.statusCode,
      { query },
      error
    );
  }
};

// intelligence/src/intelligence/search/specializedSearch.js
/**
 * @file Implements specialized search agents for different source types (News, Academic, etc.).
 * @module @daitanjs/intelligence/search/specializedSearch
 */
import { getLogger } from '@daitanjs/development';
import { googleSearch, downloadAndExtract } from '@daitanjs/web';
import { generateIntelligence } from '../../intelligence/core/llmOrchestrator.js';

const logger = getLogger('daitan-specialized-search');

/**
 * @typedef {import('@daitanjs/web').GoogleSearchResultItem} GoogleSearchResultItem
 */

/**
 * @typedef {Object} SourcedContent
 * @property {string} url - The source URL.
 * @property {string} title - The title of the page or document.
 * @property {string} content - The extracted and cleaned text content.
 * @property {string} [publishedDate] - The publication date, if found.
 */

/**
 * @typedef {Object} SearchAgentOptions
 * @property {(update: { source: string, status: 'scraping' | 'summarizing' | 'complete' | 'failed', data?: any }) => void} [onProgress]
 * @property {boolean} [verbose=false]
 */

/**
 * A specialized research agent focused on finding recent news articles.
 * It uses date restrictions in its search queries and attempts to extract publication dates.
 *
 * @param {string} query - The search query.
 * @param {SearchAgentOptions} [options={}] - Options for the search agent.
 * @returns {Promise<SourcedContent[]>} A promise that resolves to an array of sourced content objects.
 */
export async function searchNews(query, options = {}) {
  const callId = `news-search-${Date.now().toString(36)}`;
  logger.info(`[${callId}] Starting news search for query: "${query}"`);

  try {
    // Step 1: Search Google with a date restriction to prioritize recent news.
    const searchResults = await googleSearch({
      query,
      num: 5,
      dateRestrict: 'm1', // Prioritize results from the last month
    });

    if (!searchResults || searchResults.length === 0) {
      logger.info(`[${callId}] No recent news results found for query.`);
      return [];
    }

    // Step 2: Scrape and process results in parallel.
    const processingPromises = searchResults.map(async (result) => {
      if (options.onProgress) {
        options.onProgress({ source: result.link, status: 'scraping' });
      }

      try {
        const content = await downloadAndExtract(result.link, {
          outputFormat: 'cleanText',
          strategy: 'robust',
        });

        if (!content || content.length < 100) {
          throw new Error('Extracted content is too short to be useful.');
        }

        const dateMatch = content
          .substring(0, 1500)
          .match(
            /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4}|(\d{4}-\d{2}-\d{2})/
          );

        const sourcedContent = {
          url: result.link,
          title: result.title,
          content: content,
          publishedDate: dateMatch ? dateMatch[0] : undefined,
        };

        if (options.onProgress) {
          options.onProgress({
            source: result.link,
            status: 'complete',
            data: sourcedContent.title,
          });
        }
        return sourcedContent;
      } catch (error) {
        logger.warn(
          `[${callId}] Failed to process news source ${result.link}: ${error.message}`
        );
        if (options.onProgress) {
          options.onProgress({
            source: result.link,
            status: 'failed',
            data: error.message,
          });
        }
        return null;
      }
    });

    const allSourcedContent = (await Promise.all(processingPromises)).filter(
      Boolean
    );

    logger.info(
      `[${callId}] News search complete. Retrieved and processed ${allSourcedContent.length} sources.`
    );
    return allSourcedContent;
  } catch (error) {
    logger.error(
      `[${callId}] A critical error occurred during the news search workflow: ${error.message}`
    );
    throw error;
  }
}

/**
 * A specialized research agent for finding academic papers and scholarly articles.
 * (Placeholder for future implementation)
 */
export async function searchAcademic(query, options = {}) {
  logger.info(
    `[ACADEMIC-STUB] Academic search called for query: "${query}". This feature is not yet fully implemented.`
  );
  return Promise.resolve([]);
}

/**
 * A research agent for general web content.
 */
export async function searchGeneralWeb(query, options = {}) {
  const callId = `general-search-${Date.now().toString(36)}`;
  logger.info(`[${callId}] Starting general web search for query: "${query}"`);

  try {
    const searchResults = await googleSearch({ query, num: 3 });
    if (!searchResults || searchResults.length === 0) return [];

    const processingPromises = searchResults.map(async (result) => {
      if (options.onProgress)
        options.onProgress({ source: result.link, status: 'scraping' });
      try {
        const content = await downloadAndExtract(result.link, {
          outputFormat: 'cleanText',
        });
        if (!content || content.length < 100) return null;

        const sourcedContent = {
          url: result.link,
          title: result.title,
          content,
        };
        if (options.onProgress)
          options.onProgress({
            source: result.link,
            status: 'complete',
            data: sourcedContent.title,
          });
        return sourcedContent;
      } catch (error) {
        logger.warn(
          `[${callId}] Failed to process web source ${result.link}: ${error.message}`
        );
        if (options.onProgress)
          options.onProgress({
            source: result.link,
            status: 'failed',
            data: error.message,
          });
        return null;
      }
    });

    const allSourcedContent = (await Promise.all(processingPromises)).filter(
      Boolean
    );
    logger.info(
      `[${callId}] General web search complete. Processed ${allSourcedContent.length} sources.`
    );
    return allSourcedContent;
  } catch (error) {
    logger.error(
      `[${callId}] A critical error occurred during the general web search: ${error.message}`
    );
    throw error;
  }
}

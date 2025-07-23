// packages/intelligence/src/intelligence/workflows/presets/searchAndUnderstand.js (version 1.0.1)
/**
 * @file A high-level workflow that searches the web, scrapes content, and synthesizes an answer.
 * @module @daitanjs/intelligence/workflows/presets/searchAndUnderstand
 */
import { getLogger } from '@daitanjs/development';
import { googleSearch, downloadAndExtract } from '@daitanjs/web';
import { generateIntelligence } from '../../core/llmOrchestrator.js';
// CORRECTED: Import the necessary error classes
import { DaitanOperationError, DaitanInvalidInputError } from '@daitanjs/error';

const logger = getLogger('daitan-search-understand-workflow');

/**
 * @typedef {import('@daitanjs/web/search').GoogleSearchResultItem} GoogleSearchResultItem
 * @typedef {import('../../core/llmOrchestrator.js').LLMUsageInfo} LLMUsageInfo
 * @typedef {import('../../core/llmOrchestrator.js').CallConfiguration} CallConfiguration
 */

/**
 * @typedef {Object} UnderstandingResult
 * @property {string} answer - The synthesized, direct answer to the query.
 * @property {string[]} sources - An array of URLs used to generate the answer.
 * @property {LLMUsageInfo | null} usage - The token usage for the synthesis step.
 * @property {GoogleSearchResultItem[]} searchResults - The raw search results that were processed.
 */

/**
 * @typedef {Object} SearchAndUnderstandOptions
 * @property {number} [numResults=3] - The number of top search results to process (1-5).
 * @property {CallConfiguration} [llmConfig] - Configuration for the `generateIntelligence` call used for synthesis.
 * @property {boolean} [verbose=false] - Enable detailed logging for the entire operation.
 */

export const searchAndUnderstand = async (query, options = {}) => {
  const callId = `understand-${Date.now().toString(36)}`;
  const { numResults = 3, llmConfig = {}, verbose = false } = options;

  if (!query || typeof query !== 'string' || !query.trim()) {
    throw new DaitanInvalidInputError(
      'A valid query string is required for searchAndUnderstand.'
    );
  }

  logger.info(
    `[${callId}] searchAndUnderstand initiated for query: "${query}"`
  );

  try {
    // Step 1: Search the web
    logger.info(`[${callId}] Step 1: Searching the web...`);
    const searchResults = await googleSearch({ query, num: numResults });
    if (!searchResults || searchResults.length === 0) {
      logger.warn(`[${callId}] No search results found. Cannot proceed.`);
      return {
        answer:
          'I could not find any relevant information on the web for your query.',
        sources: [],
        usage: null,
        searchResults: [],
      };
    }
    const urlsToProcess = searchResults.map((res) => res.link);
    logger.info(`[${callId}] Found ${urlsToProcess.length} URLs to process.`);

    // Step 2: Scrape content from top results in parallel
    logger.info(`[${callId}] Step 2: Scraping content from URLs...`);
    const scrapingPromises = urlsToProcess.map(async (url) => {
      try {
        const content = await downloadAndExtract(url, {
          strategy: 'robust',
          outputFormat: 'cleanText',
        });
        return { url, content };
      } catch (error) {
        // This catch block is now safe because DaitanOperationError is imported.
        logger.warn(`[${callId}] Failed to scrape ${url}: ${error.message}`);
        return { url, content: null };
      }
    });

    const scrapedContents = (await Promise.all(scrapingPromises)).filter(
      (res) => res.content && res.content.trim()
    );

    if (scrapedContents.length === 0) {
      logger.warn(
        `[${callId}] Could not scrape any content. Cannot synthesize answer.`
      );
      return {
        answer:
          'I found search results, but was unable to access their content to provide a direct answer.',
        sources: urlsToProcess,
        usage: null,
        searchResults,
      };
    }

    // Step 3: Synthesize an answer using an LLM
    logger.info(
      `[${callId}] Step 3: Synthesizing answer from ${scrapedContents.length} sources...`
    );
    const contextForLLM = scrapedContents
      .map(
        (doc, i) =>
          `--- Source ${i + 1} (URL: ${doc.url}) ---\n${doc.content.substring(
            0,
            8000
          )}\n--- End Source ${i + 1} ---`
      )
      .join('\n\n');

    // --- DEFINITIVE FIX: Stricter, more robust synthesis prompt ---
    const synthesisUserPrompt = `Answer the following query based ONLY on the provided sources. Cite the source number [number] for each piece of information you use. If the sources do not contain the answer, you MUST respond with the exact phrase: "The provided sources do not contain a direct answer to this query."

Query: "${query}"

Sources:
${contextForLLM}`;

    const { response, usage } = await generateIntelligence({
      prompt: {
        system: {
          persona: 'You are a factual research assistant.',
          task: "Synthesize a direct answer to the user's query based strictly on the provided sources, citing each piece of information with its source number (e.g., [1], [2]). If the information is not present, you must state that.",
        },
        user: synthesisUserPrompt,
      },
      config: {
        response: { format: 'text' },
        llm: {
          target: 'MASTER_COMMUNICATOR',
          temperature: 0.0, // Set to 0.0 for factual, non-creative tasks
          maxTokens: 1500,
          ...(llmConfig.llm || {}),
        },
        verbose,
        ...(llmConfig || {}),
      },
      metadata: { summary: `Synthesize answer for: ${query}` },
    });

    logger.info(`[${callId}] searchAndUnderstand completed successfully.`);

    return {
      answer: response,
      sources: scrapedContents.map((doc) => doc.url),
      usage,
      searchResults,
    };
  } catch (error) {
    logger.error(
      `[${callId}] An unhandled error occurred in searchAndUnderstand: ${error.message}`
    );
    throw new DaitanOperationError(
      `Failed to complete the search and understand process: ${error.message}`,
      { query },
      error
    );
  }
};
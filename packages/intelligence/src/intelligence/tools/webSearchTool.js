// intelligence/src/intelligence/tools/webSearchTool.js
/**
 * @file A DaitanJS tool for performing web searches via the Google Search API.
 * @module @daitanjs/intelligence/tools/webSearchTool
 *
 * @description
 * This module exports `webSearchTool`, a LangChain-compatible `DynamicTool`. It
 * provides a structured interface for an AI agent to search the web by wrapping

 * the `googleSearch` function from `@daitanjs/web`. A key feature is its lazy
 * initialization, which defers loading the underlying search service until the
 * tool is first used, improving initial application load times.
 */
import { DynamicTool } from '@langchain/core/tools';
import { getLogger } from '@daitanjs/development';
import { DaitanConfigurationError } from '@daitanjs/error';
import { z } from 'zod';

const webSearchLogger = getLogger('daitan-tool-web-search');
const TOOL_NAME = 'web_search';

// --- Lazy-loaded search function ---
let googleSearchFunction = null;
let googleSearchInitializationAttempted = false;

// Zod schema for robust input validation.
const WebSearchInputSchema = z
  .object({
    // Use `query` to match the underlying service, simplifying the mapping.
    query: z
      .string()
      .min(1, 'Search query cannot be empty.')
      .max(200, 'Search query is too long.')
      .describe('The string to search for on the web.'),
    num_results: z
      .number()
      .int()
      .min(1)
      .max(10)
      .optional()
      .default(3) // A sensible default for most agent use cases.
      .describe('The number of search results to return (1-10).'),
  })
  .strict(); // Disallow any other properties on the input object.

/**
 * Lazily initializes the Google Search service from @daitanjs/web on first use.
 * This prevents a hard dependency and improves startup performance.
 * @private
 * @returns {Promise<Function|null>} The googleSearch function or null if initialization fails.
 */
async function initializeGoogleSearchService() {
  if (googleSearchFunction) {
    return googleSearchFunction;
  }
  if (googleSearchInitializationAttempted) {
    return null; // Avoid re-attempting a failed import.
  }

  googleSearchInitializationAttempted = true;
  try {
    const webModule = await import('@daitanjs/web');
    if (webModule && typeof webModule.googleSearch === 'function') {
      googleSearchFunction = webModule.googleSearch;
      webSearchLogger.info('Web search service initialized successfully.');
    } else {
      throw new DaitanConfigurationError(
        'The @daitanjs/web package does not export a "googleSearch" function.'
      );
    }
  } catch (e) {
    webSearchLogger.error(
      `Failed to load 'googleSearch' from '@daitanjs/web'. This tool will not function. Error: ${e.message}`
    );
    googleSearchFunction = null;
  }
  return googleSearchFunction;
}

/**
 * A LangChain-compatible tool for performing web searches.
 */
export const webSearchTool = new DynamicTool({
  name: TOOL_NAME,
  description: `Performs a web search for a given query.
Input must be an object with the following keys:
- "query" (string): The search query.
- "num_results" (integer, optional): The number of results to return (1-10, default 3).
Returns a formatted string containing the top search results with titles, links, and snippets.`,
  schema: WebSearchInputSchema,
  func: async (input) => {
    try {
      const searchService = await initializeGoogleSearchService();
      if (!searchService) {
        throw new DaitanConfigurationError(
          'Web search service is not available. Check for initialization errors.'
        );
      }

      // The input is already validated by the DynamicTool's schema.
      // We map the validated `num_results` to the `num` parameter expected by the service.
      const searchParams = {
        query: input.query,
        num: input.num_results,
      };

      const results = await searchService(searchParams);

      if (!results || !Array.isArray(results) || results.length === 0) {
        return `No web search results found for "${input.query}".`;
      }

      const formattedResults = results
        .map(
          (item, index) =>
            `${index + 1}. Title: ${item.title}\n   Link: ${
              item.link
            }\n   Snippet: ${String(item.snippet || '').substring(0, 250)}...`
        )
        .join('\n\n');

      return `Web Search Results for "${input.query}":\n${formattedResults}`;
    } catch (error) {
      // The tool should return a string error message for the agent to process.
      return `Error performing web search for "${JSON.stringify(input)}": ${
        error.message
      }.`;
    }
  },
});

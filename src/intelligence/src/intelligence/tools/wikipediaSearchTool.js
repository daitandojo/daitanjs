// intelligence/src/intelligence/tools/wikipediaSearchTool.js
import { getLogger } from '@daitanjs/development';
import { DaitanValidationError, DaitanOperationError } from '@daitanjs/error';
import { z } from 'zod';
import { createDaitanTool } from '../core/toolFactory.js'; // CORRECTED: Import from the new 'core' location

const wikipediaLogger = getLogger('daitan-tool-wikipedia');
const TOOL_NAME = 'wikipedia_search';
const WIKIPEDIA_API_ENDPOINT = 'https://en.wikipedia.org/w/api.php'; // Default to English Wikipedia

// Zod schema for the input
const WikipediaSearchInputSchema = z
  .object({
    query: z
      .string()
      .min(1, 'Search query cannot be empty.')
      .max(150, 'Search query is too long for Wikipedia search.'),
    // lang: z.string().length(2).optional().default('en'), // Optional: specify Wikipedia language (e.g., "es", "de")
    num_results: z.number().int().min(1).max(3).optional().default(1), // Max 1-3 results usually enough for LLM
  })
  .strict();

export const wikipediaSearchTool = createDaitanTool(
  TOOL_NAME,
  `Searches Wikipedia for a given query string and returns a summary of the most relevant article(s).
Input must be an object: {"query": "your search term", "num_results": 1 (optional, 1-3, default 1)}.
Useful for finding factual information, definitions, or overviews on a wide range of topics, people, places, and events.
Provides titles and concise summaries of Wikipedia articles.`,
  async (input) => {
    // input can be string or object
    const callId = Math.random().toString(36).substring(2, 9);
    const startTime = Date.now();
    let validatedArgs;
    let originalQueryForLog;

    wikipediaLogger.info(`Tool "${TOOL_NAME}" execution: START`, {
      callId,
      rawInput: input,
    });

    try {
      // Input normalization and validation
      if (typeof input === 'string') {
        try {
          const parsedInput = JSON.parse(input);
          if (typeof parsedInput === 'object' && parsedInput !== null) {
            validatedArgs = WikipediaSearchInputSchema.parse(parsedInput);
          } else {
            // If parsed is not an object, assume string input is the query
            validatedArgs = WikipediaSearchInputSchema.parse({ query: input });
          }
        } catch (e) {
          // If JSON.parse fails, assume string input is the query
          validatedArgs = WikipediaSearchInputSchema.parse({ query: input });
        }
      } else if (typeof input === 'object' && input !== null) {
        validatedArgs = WikipediaSearchInputSchema.parse(input);
      } else {
        throw new DaitanValidationError(
          'Input must be a string (search query or JSON stringified object) or an object with a "query" key.',
          { inputType: typeof input }
        );
      }
      originalQueryForLog = validatedArgs.query;

      const searchUrl = new URL(WIKIPEDIA_API_ENDPOINT);
      searchUrl.searchParams.append('action', 'query');
      searchUrl.searchParams.append('list', 'search');
      searchUrl.searchParams.append('srsearch', validatedArgs.query);
      searchUrl.searchParams.append(
        'srlimit',
        String(validatedArgs.num_results)
      );
      searchUrl.searchParams.append('srprop', 'snippet|titlesnippet'); // Request snippet and title snippet
      searchUrl.searchParams.append('format', 'json');
      searchUrl.searchParams.append('origin', '*'); // For CORS, if ever called from browser contexts (though this tool is server-side)

      wikipediaLogger.debug(`Fetching Wikipedia URL: ${searchUrl.toString()}`, {
        callId,
      });

      const response = await fetch(searchUrl.toString(), {
        headers: {
          'User-Agent':
            'DaitanJS-Intelligence-Library/1.1 (https://github.com/daitandojo/@daitanjs)',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new DaitanOperationError(
          `Wikipedia API request failed with status ${
            response.status
          }. Response: ${errorText.substring(0, 200)}`,
          {
            query: validatedArgs.query,
            httpStatus: response.status,
            apiResponse: errorText.substring(0, 200),
          }
        );
      }

      const data = await response.json();
      const duration = Date.now() - startTime;

      if (data.query?.search?.length > 0) {
        const searchResults = data.query.search;
        const formattedResults = searchResults
          .map((item, index) => {
            // Clean snippets (remove HTML tags)
            const snippet = String(item.snippet || item.titlesnippet || '')
              .replace(/<span class="searchmatch">/gi, '')
              .replace(/<\/span>/gi, '')
              .replace(/<\/?\w+[^>]*>/g, ' ') // Basic HTML tag removal
              .replace(/\s+/g, ' ')
              .trim();
            return `${index + 1}. Title: ${
              item.title
            }\n   Summary Snippet: ${snippet}\n   Wikipedia URL: https://en.wikipedia.org/wiki/${encodeURIComponent(
              item.title.replace(/ /g, '_')
            )}`;
          })
          .join('\n\n');

        wikipediaLogger.info(`Tool "${TOOL_NAME}" execution: SUCCESS.`, {
          callId,
          query: validatedArgs.query,
          resultsFound: searchResults.length,
          durationMs: duration,
        });
        return `Wikipedia Search Results for "${validatedArgs.query}":\n${formattedResults}`;
      } else {
        wikipediaLogger.info(
          `Tool "${TOOL_NAME}" execution: SUCCESS (No Results).`,
          { callId, query: validatedArgs.query, durationMs: duration }
        );
        return `No Wikipedia results found for query: "${validatedArgs.query}". Try a different or broader query.`;
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      wikipediaLogger.error(`Tool "${TOOL_NAME}" execution: FAILED.`, {
        callId,
        queryAttempted:
          originalQueryForLog ||
          (typeof input === 'string' ? input : JSON.stringify(input)),
        errorMessage: error.message,
        errorName: error.name,
        durationMs: duration,
      });
      if (error instanceof DaitanValidationError || error.name === 'ZodError') {
        return `Error: Invalid input for Wikipedia search. ${
          error.errors
            ? error.errors.map((e) => e.message).join(', ')
            : error.message
        }`;
      }
      return `Error searching Wikipedia for "${
        originalQueryForLog || input
      }": ${error.message}.`;
    }
  },
  WikipediaSearchInputSchema
);

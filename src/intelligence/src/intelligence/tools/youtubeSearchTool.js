// intelligence/src/intelligence/tools/youtubeSearchTool.js
/**
 * @file A DaitanJS tool for searching YouTube videos.
 * @module @daitanjs/intelligence/tools/youtubeSearchTool
 *
 * @description
 * This module exports a LangChain-compatible tool that allows an AI agent to
 * search for videos on YouTube using the `searchVideos` function from the
 * `@daitanjs/media` package. It provides a structured way for the agent to
 * find video content based on a query.
 */

import { createDaitanTool } from '../core/toolFactory.js'; // CORRECTED: Import from the new 'core' location
import { z } from 'zod';
import { searchVideos } from '@daitanjs/media';
import { DaitanNotFoundError } from '@daitanjs/error';

const YoutubeSearchInputSchema = z
  .object({
    query: z
      .string()
      .min(1, 'Search query cannot be empty.')
      .max(150, 'Search query is too long.'),
    maxResults: z
      .number()
      .int()
      .min(1)
      .max(5)
      .optional()
      .default(3)
      .describe('Number of search results to return, between 1 and 5.'),
  })
  .strict();

export const youtubeSearchTool = createDaitanTool(
  'youtube_search',
  `Searches YouTube for videos based on a query string.
The input must be an object with:
- "query" (string): The search term or phrase.
- "maxResults" (integer, optional, 1-5): The maximum number of video results to return. Defaults to 3.
This tool returns a list of videos, each with a title, video ID, and a link.`,
  async (input) => {
    const validatedInput = YoutubeSearchInputSchema.parse(input);

    const searchResult = await searchVideos(validatedInput.query, {
      maxResults: validatedInput.maxResults,
    });

    if (
      !searchResult ||
      !searchResult.items ||
      searchResult.items.length === 0
    ) {
      throw new DaitanNotFoundError(
        `No YouTube videos found for the query: "${validatedInput.query}"`
      );
    }

    const formattedResults = searchResult.items.map((item) => ({
      title: item.snippet?.title,
      videoId: item.id?.videoId,
      channelTitle: item.snippet?.channelTitle,
      publishedAt: item.snippet?.publishedAt,
      link: `https://www.youtube.com/watch?v=${item.id?.videoId}`,
    }));

    return `Found ${formattedResults.length} YouTube videos for "${
      validatedInput.query
    }":\n${JSON.stringify(formattedResults, null, 2)}`;
  },
  YoutubeSearchInputSchema
);

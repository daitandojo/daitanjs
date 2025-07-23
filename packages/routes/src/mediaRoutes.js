// routes/src/mediaRoutes.js
/**
 * @file Reusable Next.js App Router route handlers for media services.
 * @module @daitanjs/routes/mediaRoutes
 *
 * @description
 * This module provides API route handlers for functionalities in the
 * `@daitanjs/media` package, such as searching YouTube. These routes
 * act as a secure proxy to the underlying media APIs.
 */

import { searchVideos } from '@daitanjs/media';
import { handleApiError, createSuccessResponse } from './helpers.js';
import { withAuth } from '@daitanjs/middleware';

/**
 * Route handler for searching YouTube videos.
 * Expects a GET request with a `query` parameter, and other optional
 * search parameters supported by the `searchVideos` service.
 *
 * @param {import('next/server').NextRequest} req - The Next.js request object.
 * @returns {Promise<import('next/server').NextResponse>}
 */
async function youtubeSearchHandler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('query');

    const options = {};
    for (const [key, value] of searchParams.entries()) {
      if (key !== 'query') {
        // Coerce numbers where appropriate, e.g., maxResults
        options[key] = !isNaN(parseInt(value, 10))
          ? parseInt(value, 10)
          : value;
      }
    }

    // Call the refactored searchVideos service with a single parameter object
    const searchResults = await searchVideos({
      query,
      ...options,
    });

    return createSuccessResponse(searchResults);
  } catch (error) {
    return handleApiError(error, 'youtubeSearch');
  }
}

// Searching YouTube can be a public or private feature depending on the app's needs.
// Protecting it by default is a good practice to manage API quota usage.
export const handleYoutubeSearch = withAuth(youtubeSearchHandler);

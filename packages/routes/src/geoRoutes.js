// routes/src/geoRoutes.js
/**
 * @file Reusable Next.js App Router route handlers for geolocation services.
 * @module @daitanjs/routes/geoRoutes
 *
 * @description
 * This module provides API route handlers for the geocoding functionalities in
 * the `@daitanjs/geo` package. It exposes endpoints for forward (address -> coords)
 * and reverse (coords -> address) geocoding. These routes are protected by
 * authentication middleware to prevent abuse of the underlying API keys.
 */

import { forwardGeocode, reverseGeocode } from '@daitanjs/geo';
import {
  handleApiError,
  createSuccessResponse,
  getJsonBody,
} from './helpers.js';
import { withAuth } from '@daitanjs/middleware';

/**
 * Route handler for forward geocoding.
 * Expects a POST request with a JSON body: `{ "locationQuery": "...", "limit": 5 }`.
 * @param {import('next/server').NextRequest} req
 * @returns {Promise<import('next/server').NextResponse>}
 */
async function forwardGeocodeHandler(req) {
  try {
    const payload = await getJsonBody(req);
    const results = await forwardGeocode(payload);
    return createSuccessResponse(results);
  } catch (error) {
    return handleApiError(error, 'forwardGeocode');
  }
}
export const handleForwardGeocode = withAuth(forwardGeocodeHandler);

/**
 * Route handler for reverse geocoding.
 * Expects a POST request with a JSON body: `{ "coordinates": [lon, lat] }`.
 * @param {import('next/server').NextRequest} req
 * @returns {Promise<import('next/server').NextResponse>}
 */
async function reverseGeocodeHandler(req) {
  try {
    const payload = await getJsonBody(req);
    const results = await reverseGeocode(payload);
    return createSuccessResponse(results);
  } catch (error) {
    return handleApiError(error, 'reverseGeocode');
  }
}
export const handleReverseGeocode = withAuth(reverseGeocodeHandler);

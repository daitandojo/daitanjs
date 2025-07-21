// geo/src/geocodingService.js
/**
 * @file Provides geocoding and reverse geocoding services, primarily using Mapbox.
 * @module @daitanjs/geo/geocodingService
 */

import { getLogger } from '@daitanjs/development';
import { getConfigManager } from '@daitanjs/config';
import {
  DaitanApiError,
  DaitanConfigurationError,
  DaitanOperationError,
  DaitanInvalidInputError,
} from '@daitanjs/error';
import { query as apiQuery } from '@daitanjs/apiqueries';
import { MAPBOX_GEOCODING_API_URL } from './constants.js';

const geocodingLogger = getLogger('daitan-geo-geocoding');

/** @private */
function getMapboxTokenInternal() {
  const configManager = getConfigManager(); // Lazy-load
  const token = configManager.get('MAPBOX_TOKEN');
  if (!token) {
    throw new DaitanConfigurationError(
      'MAPBOX_TOKEN is required for geocoding operations but not configured.'
    );
  }
  return token;
}

/**
 * Performs forward geocoding: converts a location query string to coordinates.
 * @public
 * @async
 * @param {object} params
 * @returns {Promise<Array<object>>} An array of geocoding result objects.
 */
export const forwardGeocode = async ({
  locationQuery,
  limit = 5,
  language = 'en',
  country,
  bbox,
  proximity,
  types,
  mapboxToken: explicitToken,
}) => {
  const callId = `fwdGeo-${Date.now().toString(36)}`;
  geocodingLogger.info(
    `[${callId}] forwardGeocode: Starting for: "${String(
      locationQuery
    ).substring(0, 50)}"`
  );

  if (
    typeof window !== 'undefined' &&
    !process.env.DAITAN_ALLOW_BROWSER_GEO_API_CALLS
  ) {
    throw new DaitanOperationError(
      'forwardGeocode is for server-side use. Set DAITAN_ALLOW_BROWSER_GEO_API_CALLS to override.'
    );
  }
  if (
    !locationQuery ||
    typeof locationQuery !== 'string' ||
    !locationQuery.trim()
  ) {
    throw new DaitanInvalidInputError(
      'Location query must be a non-empty string.'
    );
  }

  const mapboxTokenToUse = explicitToken || getMapboxTokenInternal();
  const apiUrl = `${MAPBOX_GEOCODING_API_URL}/${encodeURIComponent(
    locationQuery
  )}.json`;
  const queryParams = {
    access_token: mapboxTokenToUse,
    limit: Math.max(1, Math.min(limit, 10)),
    language,
    ...(country && { country }),
    ...(Array.isArray(bbox) && bbox.length === 4 && { bbox: bbox.join(',') }),
    ...(Array.isArray(proximity) &&
      proximity.length === 2 && { proximity: proximity.join(',') }),
    ...(Array.isArray(types) && types.length > 0 && { types: types.join(',') }),
  };

  try {
    const data = await apiQuery({
      url: apiUrl,
      params: queryParams,
      summary: `Forward geocode: ${String(locationQuery).substring(0, 30)}`,
    });

    if (!data.features) return [];

    return data.features.map((feature) => ({
      id: feature.id,
      place_name: feature.place_name,
      text: feature.text,
      center: feature.center,
      geometry: feature.geometry,
      context: feature.context,
      relevance: feature.relevance,
      address: feature.address,
      properties: feature.properties,
    }));
  } catch (error) {
    if (error instanceof DaitanApiError) throw error;
    throw new DaitanApiError(
      `Failed to fetch forward geocoding data: ${error.message}`,
      'Mapbox Geocoding API',
      error.response?.status,
      { requestUrl: apiUrl },
      error
    );
  }
};

/**
 * Performs reverse geocoding: converts coordinates to a place name or address.
 * @public
 * @async
 * @param {object} params
 * @returns {Promise<Array<object>>} An array of reverse geocoding results.
 */
export const reverseGeocode = async ({
  coordinates,
  language = 'en',
  types,
  mapboxToken: explicitToken,
}) => {
  if (
    typeof window !== 'undefined' &&
    !process.env.DAITAN_ALLOW_BROWSER_GEO_API_CALLS
  ) {
    throw new DaitanOperationError(
      'reverseGeocode is for server-side use. Set DAITAN_ALLOW_BROWSER_GEO_API_CALLS to override.'
    );
  }
  if (
    !Array.isArray(coordinates) ||
    coordinates.length !== 2 ||
    !coordinates.every((c) => typeof c === 'number' && !isNaN(c))
  ) {
    throw new DaitanInvalidInputError(
      'Coordinates must be an array of two numbers [longitude, latitude].'
    );
  }

  const mapboxTokenToUse = explicitToken || getMapboxTokenInternal();
  const [longitude, latitude] = coordinates;
  const apiUrl = `${MAPBOX_GEOCODING_API_URL}/${longitude},${latitude}.json`;
  const queryParams = {
    access_token: mapboxTokenToUse,
    language,
    limit: 1,
    ...(Array.isArray(types) && types.length > 0 && { types: types.join(',') }),
  };

  try {
    const data = await apiQuery({
      url: apiUrl,
      params: queryParams,
      summary: `Reverse geocode: ${longitude},${latitude}`,
    });

    if (!data.features) return [];

    return data.features.map((feature) => ({
      id: feature.id,
      place_name: feature.place_name,
      text: feature.text,
      center: feature.center,
      geometry: feature.geometry,
      context: feature.context,
      relevance: feature.relevance,
      address: feature.address,
      properties: feature.properties,
    }));
  } catch (error) {
    if (error instanceof DaitanApiError) throw error;
    throw new DaitanApiError(
      `Failed to fetch reverse geocoding data: ${error.message}`,
      'Mapbox Geocoding API',
      error.response?.status,
      { requestUrl: apiUrl },
      error
    );
  }
};

/**
 * Utility to extract a country code from geocoding results.
 * @public
 */
export const extractCountryFromGeocodeResults = (geocodeResults) => {
  if (!Array.isArray(geocodeResults) || geocodeResults.length === 0)
    return null;
  const firstResult = geocodeResults[0];
  if (firstResult?.context) {
    for (const contextItem of firstResult.context) {
      if (contextItem.id?.startsWith('country.') && contextItem.short_code) {
        return contextItem.short_code.toUpperCase();
      }
    }
  }
  return null;
};

/**
 * Utility to extract city name from geocoding results.
 * @public
 */
export const extractCityFromGeocodeResults = (geocodeResults) => {
  if (!Array.isArray(geocodeResults) || geocodeResults.length === 0)
    return null;
  const firstResult = geocodeResults[0];
  if (firstResult?.context) {
    const placeItem = firstResult.context.find((item) =>
      item.id?.startsWith('place.')
    );
    if (placeItem?.text) return placeItem.text;
  }
  if (firstResult?.id?.startsWith('place.') && firstResult.text) {
    return firstResult.text;
  }
  return null;
};

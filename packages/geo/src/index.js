// geo/src/index.js
/**
 * @file Main entry point for the @daitanjs/geo package.
 * Exports core geolocation functionalities.
 * @module @daitanjs/geo
 */
import { getLogger } from '@daitanjs/development';
import {
  MAPBOX_GEOCODING_API_URL,
  NOMINATIM_API_URL,
  EARTH_RADIUS_KM,
  SUPPORTED_COUNTRIES_ISO_A2,
} from './constants.js';
import {
  degreesToRadians,
  radiansToDegrees,
  calculateHaversineDistance,
  calculateDestinationPoint,
  calculateBoundingBox,
  isPointInBoundingBox,
  calculateMidpoint,
} from './utils.js';
import {
  encodeGeohash,
  decodeGeohash,
  getGeohashNeighbors,
} from './geoHash.js';
import {
  forwardGeocode,
  reverseGeocode,
  extractCountryFromGeocodeResults,
  extractCityFromGeocodeResults,
} from './geocodingService.js';
import {
  DaitanInvalidInputError,
  DaitanConfigurationError,
} from '@daitanjs/error';

const geoIndexLogger = getLogger('daitan-geo-index');

export {
  MAPBOX_GEOCODING_API_URL,
  NOMINATIM_API_URL,
  EARTH_RADIUS_KM,
  SUPPORTED_COUNTRIES_ISO_A2,
  degreesToRadians,
  radiansToDegrees,
  calculateHaversineDistance,
  calculateDestinationPoint,
  calculateBoundingBox,
  isPointInBoundingBox,
  calculateMidpoint,
  encodeGeohash,
  decodeGeohash,
  getGeohashNeighbors,
  forwardGeocode,
  reverseGeocode,
  extractCountryFromGeocodeResults,
  extractCityFromGeocodeResults,
};

/**
 * General handler for geo requests.
 * @public
 * @param {object} params
 * @returns {Promise<Array<object>|object|null>}
 */
export const geoHandler = async ({
  type,
  query,
  limit = 5,
  language = 'en',
  mapboxToken,
}) => {
  if (!type || (type !== 'forward' && type !== 'reverse')) {
    throw new DaitanConfigurationError(
      'Invalid geocoding type. Must be "forward" or "reverse".'
    );
  }
  if (!query) {
    throw new DaitanInvalidInputError(
      'Query (location string or coordinates array) is required.'
    );
  }

  if (type === 'forward') {
    if (typeof query !== 'string')
      throw new DaitanInvalidInputError(
        'For "forward" geocoding, query must be a string.'
      );
    return forwardGeocode({
      locationQuery: query,
      limit,
      language,
      mapboxToken,
    });
  } else {
    if (!Array.isArray(query) || query.length !== 2)
      throw new DaitanInvalidInputError(
        'For "reverse" geocoding, query must be an array of two numbers [longitude, latitude].'
      );
    return reverseGeocode({ coordinates: query, language, mapboxToken });
  }
};

/**
 * Gets the country from coordinates.
 * @public
 * @returns {Promise<string | null>}
 */
export const getCountryFromCoordinates = async ({
  latitude,
  longitude,
  mapboxToken,
}) => {
  const results = await reverseGeocode({
    coordinates: [longitude, latitude],
    types: ['country'],
    mapboxToken,
  });
  return extractCountryFromGeocodeResults(results);
};

/**
 * Gets the nearest city from coordinates.
 * @public
 * @returns {Promise<string | null>}
 */
export const getNearestCityFromCoordinates = async ({
  latitude,
  longitude,
  mapboxToken,
}) => {
  const results = await reverseGeocode({
    coordinates: [longitude, latitude],
    types: ['place', 'locality'],
    mapboxToken,
  });
  return extractCityFromGeocodeResults(results);
};

/**
 * Converts an address string to coordinates.
 * @public
 * @returns {Promise<[number, number] | null>}
 */
export const addressToCoordinates = async ({ address, mapboxToken }) => {
  const results = await forwardGeocode({
    locationQuery: address,
    limit: 1,
    mapboxToken,
  });
  if (results?.[0]?.center) {
    return [results[0].center[1], results[0].center[0]];
  }
  return null;
};

/**
 * Converts coordinates to a formatted address string.
 * @public
 * @returns {Promise<string | null>}
 */
export const coordinatesToAddress = async ({
  latitude,
  longitude,
  mapboxToken,
}) => {
  const results = await reverseGeocode({
    coordinates: [longitude, latitude],
    mapboxToken,
  });
  return results?.[0]?.place_name || null;
};

/**
 * Generates a random point within a bounding box.
 * @public
 * @returns {[number, number]}
 */
export const generateRandomPointInBoundingBox = ({
  minLat,
  maxLat,
  minLon,
  maxLon,
}) => {
  if (
    typeof minLat !== 'number' ||
    typeof maxLat !== 'number' ||
    typeof minLon !== 'number' ||
    typeof maxLon !== 'number' ||
    minLat >= maxLat ||
    minLon >= maxLon
  ) {
    throw new DaitanInvalidInputError(
      'Invalid boundingBox. Ensure min < max for lat/lon.'
    );
  }
  const lat = Math.random() * (maxLat - minLat) + minLat;
  const lon = Math.random() * (maxLon - minLon) + minLon;
  return [lat, lon];
};

/**
 * Finds points within a given radius of a center point.
 * @public
 * @returns {Array<{latitude: number, longitude: number, distanceKm?: number, [key: string]: any}>}
 */
export const findNearbyPoints = ({ centerPoint, pointsArray, radiusKm }) => {
  if (
    !Array.isArray(centerPoint) ||
    centerPoint.length !== 2 ||
    !centerPoint.every((c) => typeof c === 'number')
  ) {
    throw new DaitanInvalidInputError(
      'centerPoint must be an array of two numbers [latitude, longitude].'
    );
  }
  if (!Array.isArray(pointsArray)) {
    throw new DaitanInvalidInputError('pointsArray must be an array.');
  }
  if (typeof radiusKm !== 'number' || radiusKm < 0) {
    throw new DaitanInvalidInputError(
      'radiusKm must be a non-negative number.'
    );
  }
  return pointsArray
    .map((p) => {
      if (
        !p ||
        typeof p.latitude !== 'number' ||
        typeof p.longitude !== 'number'
      )
        return null;
      const distance = calculateHaversineDistance({
        coordinates1: centerPoint,
        coordinates2: [p.latitude, p.longitude],
      });
      return { ...p, distanceKm: distance };
    })
    .filter((p) => p !== null && p.distanceKm <= radiusKm);
};

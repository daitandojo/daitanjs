// geo/src/geohash.js
/**
 * @file Geohashing utilities using the ngeohash library.
 * @module @daitanjs/geo/geohash
 */
import ngeohash from 'ngeohash';
import { getLogger } from '@daitanjs/development';
import { DaitanInvalidInputError, DaitanOperationError } from '@daitanjs/error';

const geohashLogger = getLogger('daitan-geo-geohash');

/**
 * Encodes latitude and longitude into a geohash string.
 *
 * @public
 * @async
 * @param {object} params
 * @param {number} params.latitude
 * @param {number} params.longitude
 * @param {number} [params.precision=9]
 * @returns {string} The generated geohash string.
 */
export const encodeGeohash = ({ latitude, longitude, precision = 9 }) => {
  if (
    typeof latitude !== 'number' ||
    isNaN(latitude) ||
    latitude < -90 ||
    latitude > 90
  ) {
    throw new DaitanInvalidInputError(
      'Latitude must be a number between -90 and 90.'
    );
  }
  if (
    typeof longitude !== 'number' ||
    isNaN(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new DaitanInvalidInputError(
      'Longitude must be a number between -180 and 180.'
    );
  }
  if (
    typeof precision !== 'number' ||
    !Number.isInteger(precision) ||
    precision < 1 ||
    precision > 12
  ) {
    geohashLogger.warn(
      `Geohash precision ${precision} is outside the typical range (1-12).`
    );
  }

  try {
    return ngeohash.encode(latitude, longitude, precision);
  } catch (error) {
    throw new DaitanOperationError(
      `Geohash encoding failed: ${error.message}`,
      { latitude, longitude, precision },
      error
    );
  }
};

/**
 * Decodes a geohash string into latitude, longitude, and error margins.
 *
 * @public
 * @param {object} params
 * @param {string} params.geohash
 * @returns {{latitude: number, longitude: number, latitudeError: number, longitudeError: number}}
 */
export const decodeGeohash = ({ geohash }) => {
  if (typeof geohash !== 'string' || !geohash.trim()) {
    throw new DaitanInvalidInputError('Geohash must be a non-empty string.');
  }

  try {
    const decoded = ngeohash.decode_bbox(geohash);
    const latitude = (decoded[0] + decoded[2]) / 2;
    const longitude = (decoded[1] + decoded[3]) / 2;
    const latitudeError = (decoded[2] - decoded[0]) / 2;
    const longitudeError = (decoded[3] - decoded[1]) / 2;
    return { latitude, longitude, latitudeError, longitudeError };
  } catch (error) {
    throw new DaitanOperationError(
      `Failed to decode geohash "${geohash}": ${error.message}`,
      { geohash },
      error
    );
  }
};

/**
 * Finds neighboring geohashes for a given geohash.
 *
 * @public
 * @param {object} params
 * @param {string} params.geohash
 * @returns {{n: string, s: string, e: string, w: string, ne: string, nw: string, se: string, sw: string}}
 */
export const getGeohashNeighbors = ({ geohash }) => {
  if (typeof geohash !== 'string' || !geohash.trim()) {
    throw new DaitanInvalidInputError('Geohash must be a non-empty string.');
  }

  try {
    const [n, ne, e, se, s, sw, w, nw] = ngeohash.neighbors(geohash);
    return { n, ne, e, se, s, sw, w, nw };
  } catch (error) {
    throw new DaitanOperationError(
      `Failed to calculate neighbors for geohash "${geohash}": ${error.message}`,
      { geohash },
      error
    );
  }
};

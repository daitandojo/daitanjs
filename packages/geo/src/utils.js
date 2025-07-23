// geo/src/utils.js
/**
 * @file Utility functions for geographical calculations and conversions.
 * @module @daitanjs/geo/utils
 */

import { getLogger } from '@daitanjs/development';
import { DaitanInvalidInputError } from '@daitanjs/error';
import { EARTH_RADIUS_KM } from './constants.js';

const geoUtilLogger = getLogger('daitan-geo-utils');

/**
 * Converts degrees to radians.
 * @param {number} degrees
 * @returns {number}
 */
export const degreesToRadians = (degrees) => {
  if (typeof degrees !== 'number' || isNaN(degrees)) {
    throw new DaitanInvalidInputError('Input degrees must be a number.');
  }
  return (degrees * Math.PI) / 180;
};

/**
 * Converts radians to degrees.
 * @param {number} radians
 * @returns {number}
 */
export const radiansToDegrees = (radians) => {
  if (typeof radians !== 'number' || isNaN(radians)) {
    throw new DaitanInvalidInputError('Input radians must be a number.');
  }
  return (radians * 180) / Math.PI;
};

/**
 * Calculates the Haversine distance between two points on Earth.
 * @param {object} params
 * @returns {number} The distance between the two points in kilometers.
 */
export const calculateHaversineDistance = ({ coordinates1, coordinates2 }) => {
  if (
    !Array.isArray(coordinates1) ||
    coordinates1.length !== 2 ||
    !coordinates1.every((c) => typeof c === 'number')
  ) {
    throw new DaitanInvalidInputError(
      'coordinates1 must be an array of two numbers [latitude, longitude].'
    );
  }
  if (
    !Array.isArray(coordinates2) ||
    coordinates2.length !== 2 ||
    !coordinates2.every((c) => typeof c === 'number')
  ) {
    throw new DaitanInvalidInputError(
      'coordinates2 must be an array of two numbers [latitude, longitude].'
    );
  }

  const [lat1, lon1] = coordinates1;
  const [lat2, lon2] = coordinates2;
  const dLat = degreesToRadians(lat2 - lat1);
  const dLon = degreesToRadians(lon2 - lon1);
  const radLat1 = degreesToRadians(lat1);
  const radLat2 = degreesToRadians(lat2);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radLat1) * Math.cos(radLat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
};

/**
 * Calculates a new geographical point given a starting point, bearing, and distance.
 * @param {object} params
 * @returns {[number, number]} The destination point as [latitude, longitude].
 */
export const calculateDestinationPoint = ({
  startCoordinates,
  bearing,
  distanceKm,
}) => {
  if (
    !Array.isArray(startCoordinates) ||
    startCoordinates.length !== 2 ||
    !startCoordinates.every((c) => typeof c === 'number')
  ) {
    throw new DaitanInvalidInputError(
      'startCoordinates must be an array of two numbers [latitude, longitude].'
    );
  }
  if (typeof bearing !== 'number' || isNaN(bearing)) {
    throw new DaitanInvalidInputError('Bearing must be a number.');
  }
  if (typeof distanceKm !== 'number' || isNaN(distanceKm) || distanceKm < 0) {
    throw new DaitanInvalidInputError(
      'DistanceKm must be a non-negative number.'
    );
  }

  const [lat1, lon1] = startCoordinates;
  const lat1Rad = degreesToRadians(lat1);
  const lon1Rad = degreesToRadians(lon1);
  const bearingRad = degreesToRadians(bearing);
  const angularDistance = distanceKm / EARTH_RADIUS_KM;

  const lat2Rad = Math.asin(
    Math.sin(lat1Rad) * Math.cos(angularDistance) +
      Math.cos(lat1Rad) * Math.sin(angularDistance) * Math.cos(bearingRad)
  );
  let lon2Rad =
    lon1Rad +
    Math.atan2(
      Math.sin(bearingRad) * Math.sin(angularDistance) * Math.cos(lat1Rad),
      Math.cos(angularDistance) - Math.sin(lat1Rad) * Math.sin(lat2Rad)
    );
  lon2Rad = ((lon2Rad + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;

  return [radiansToDegrees(lat2Rad), radiansToDegrees(lon2Rad)];
};

/**
 * Calculates the bounding box around a central point given a radius.
 * @param {object} params
 * @returns {{minLat: number, maxLat: number, minLon: number, maxLon: number}}
 */
export const calculateBoundingBox = ({ latitude, longitude, radiusKm }) => {
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
  if (typeof radiusKm !== 'number' || isNaN(radiusKm) || radiusKm <= 0) {
    throw new DaitanInvalidInputError('RadiusKm must be a positive number.');
  }

  const latRad = degreesToRadians(latitude);
  const deltaLat = radiusKm / EARTH_RADIUS_KM;
  const deltaLon = radiusKm / (EARTH_RADIUS_KM * Math.cos(latRad));

  const minLat = radiansToDegrees(latRad - deltaLat);
  const maxLat = radiansToDegrees(latRad + deltaLat);
  const minLon = radiansToDegrees(degreesToRadians(longitude) - deltaLon);
  const maxLon = radiansToDegrees(degreesToRadians(longitude) + deltaLon);

  return {
    minLat: Math.max(-90, minLat),
    maxLat: Math.min(90, maxLat),
    minLon: ((minLon + 540) % 360) - 180,
    maxLon: ((maxLon + 540) % 360) - 180,
  };
};

/**
 * Checks if a point is within a given bounding box.
 * @param {object} params
 * @returns {boolean}
 */
export const isPointInBoundingBox = ({ point, boundingBox }) => {
  if (
    !Array.isArray(point) ||
    point.length !== 2 ||
    !point.every((c) => typeof c === 'number')
  ) {
    throw new DaitanInvalidInputError(
      'Point must be an array of two numbers [latitude, longitude].'
    );
  }
  if (
    !boundingBox ||
    typeof boundingBox.minLat !== 'number' ||
    typeof boundingBox.maxLat !== 'number' ||
    typeof boundingBox.minLon !== 'number' ||
    typeof boundingBox.maxLon !== 'number'
  ) {
    throw new DaitanInvalidInputError(
      'BoundingBox must be an object with minLat, maxLat, minLon, maxLon as numbers.'
    );
  }
  const [lat, lon] = point;
  return (
    lat >= boundingBox.minLat &&
    lat <= boundingBox.maxLat &&
    lon >= boundingBox.minLon &&
    lon <= boundingBox.maxLon
  );
};

/**
 * Calculates the midpoint between two geographical coordinates.
 * @param {object} params
 * @returns {[number, number]} The midpoint as [latitude, longitude].
 */
export const calculateMidpoint = ({ coordinates1, coordinates2 }) => {
  if (
    !Array.isArray(coordinates1) ||
    coordinates1.length !== 2 ||
    !coordinates1.every((c) => typeof c === 'number') ||
    !Array.isArray(coordinates2) ||
    coordinates2.length !== 2 ||
    !coordinates2.every((c) => typeof c === 'number')
  ) {
    throw new DaitanInvalidInputError(
      'Both coordinates must be arrays of two numbers [latitude, longitude].'
    );
  }
  const [lat1, lon1] = coordinates1;
  const [lat2, lon2] = coordinates2;
  const midLat = (lat1 + lat2) / 2;
  const midLon = (lon1 + lon2) / 2;
  return [midLat, midLon];
};

import ngeohash from 'ngeohash';
import { config } from 'dotenv';

const initialize = async () => {
  if (typeof window === 'undefined') {
    config();
  }
};

// Call the initialization function
initialize();

const supportedCountries = [
  "es", "nl", "gb", "de", "it", "pt", "fr", "dk", "tr", "no", "se", "id"
];

const degreesToRadians = (degrees) => (degrees * Math.PI) / 180;
const radiansToDegrees = (radians) => (radians * 180) / Math.PI;

export const forwardGeo = async (parameters) => {
  const { location, limit = 6, language = "en" } = parameters;
  if (typeof window !== 'undefined') {
    throw new Error('forwardGeo is not available in browser environments');
  }
  console.log(`Providing suggested locations in ${language} for "${location}"`);

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.append('q', location);
  url.searchParams.append('format', 'json');
  url.searchParams.append('addressdetails', '1');
  url.searchParams.append('limit', limit);
  url.searchParams.append('accept-language', language);
  url.searchParams.append('countrycodes', supportedCountries.join(','));

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Failed to fetch geocoding data: ${response.statusText}`);
  }

  const data = await response.json();
  return data.map(result => ({
    place_name: result.display_name,
    geometry: {
      coordinates: [parseFloat(result.lon), parseFloat(result.lat)],
    },
    address: result.address,
  }));
};

export const reverseGeo = async (parameters) => {
  const { coordinates, language = "en" } = parameters;
  if (typeof window !== 'undefined') {
    throw new Error('reverseGeo is not available in browser environments');
  }
  const [longitude, latitude] = coordinates.map(coord => parseFloat(coord));

  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.append('lat', latitude);
  url.searchParams.append('lon', longitude);
  url.searchParams.append('format', 'json');
  url.searchParams.append('addressdetails', '1');
  url.searchParams.append('accept-language', language);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Failed to fetch reverse geocoding data: ${response.statusText}`);
  }

  const result = await response.json();
  return {
    place_name: result.display_name,
    address: result.address,
    geometry: {
      coordinates: [longitude, latitude],
    },
  };
};

export const calcDistance = ({
  firstCoordinates,
  secondCoordinates,
}) => {
  const earthRadiusKm = 6371;

  const [lat1, lon1] = firstCoordinates.map(Number);
  const [lat2, lon2] = secondCoordinates.map(Number);

  const dLat = degreesToRadians(lat2 - lat1);
  const dLon = degreesToRadians(lon2 - lon1);

  const radLat1 = degreesToRadians(lat1);
  const radLat2 = degreesToRadians(lat2);

  const a = Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(radLat1) * Math.cos(radLat2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
};

export const latLngToGeohash = ({
  latitude,
  longitude,
  precision = 8,
}) => {
  return ngeohash.encode(latitude, longitude, precision);
};

export const geohashToLatLng = ({ geohash }) => {
  const decoded = ngeohash.decode(geohash);
  return { latitude: decoded.latitude, longitude: decoded.longitude };
};

const validateCoordinates = ({ coordinates }) => {
  if (!Array.isArray(coordinates) || coordinates.length !== 2) {
    throw new Error("Invalid coordinates format. Expected an array with two elements [longitude, latitude].");
  }
};

export const getSupportedCountries = () => supportedCountries;

export const calculateBoundingBox = ({
  latitude, 
  longitude, 
  radiusKm
}) => {
  const earthRadiusKm = 6371;

  const lat = degreesToRadians(latitude);
  const lon = degreesToRadians(longitude);

  const latDiff = radiusKm / earthRadiusKm;
  const lonDiff = Math.asin(Math.sin(latDiff) / Math.cos(lat));

  const minLat = latitude - radiansToDegrees(latDiff);
  const maxLat = latitude + radiansToDegrees(latDiff);
  const minLon = longitude - radiansToDegrees(lonDiff);
  const maxLon = longitude + radiansToDegrees(lonDiff);

  return {
    minLat,
    maxLat,
    minLon,
    maxLon
  };
};

export const generateRandomPoint = ({
  boundingBox
}) => {
  const { minLat, maxLat, minLon, maxLon } = boundingBox;

  const latitude = minLat + Math.random() * (maxLat - minLat);
  const longitude = minLon + Math.random() * (maxLon - minLon);

  return { latitude, longitude };
};

export const calculateMidpoint = ({
  coord1, 
  coord2
}) => {
  const [lat1, lon1] = coord1.map(degreesToRadians);
  const [lat2, lon2] = coord2.map(degreesToRadians);

  const dLon = lon2 - lon1;

  const Bx = Math.cos(lat2) * Math.cos(dLon);
  const By = Math.cos(lat2) * Math.sin(dLon);

  const lat3 = Math.atan2(
    Math.sin(lat1) + Math.sin(lat2),
    Math.sqrt((Math.cos(lat1) + Bx) ** 2 + By ** 2)
  );
  const lon3 = lon1 + Math.atan2(By, Math.cos(lat1) + Bx);

  return [radiansToDegrees(lat3), radiansToDegrees(lon3)];
};

export const isPointInBoundingBox = ({ 
  point, 
  boundingBox 
}) => {
  const { latitude, longitude } = point;
  const { minLat, maxLat, minLon, maxLon } = boundingBox;

  return latitude >= minLat && latitude <= maxLat && longitude >= minLon && longitude <= maxLon;
};

export const findNearbyPoints = ({ 
  point, 
  points, 
  radiusKm 
}) => {
  return points.filter(otherPoint => calcDistance([point.longitude, point.latitude], [otherPoint.longitude, otherPoint.latitude]) <= radiusKm);
};

export const coordinatesToAddress = async ({
  latitude, 
  longitude
}) => {
  if (typeof window !== 'undefined') {
    throw new Error('coordinatesToAddress is not available in browser environments');
  }
  const geoData = await reverseGeo({ coordinates: [longitude, latitude] });
  return geoData.place_name;
};

export const addressToCoordinates = async ({
  address
}) => {
  if (typeof window !== 'undefined') {
    throw new Error('addressToCoordinates is not available in browser environments');
  }
  const geoData = await forwardGeo({ location: address });
  return geoData[0]?.geometry.coordinates;
};

export const getCountryFromCoordinates = async ({
  latitude, 
  longitude
}) => {
  if (typeof window !== 'undefined') {
    throw new Error('getCountryFromCoordinates is not available in browser environments');
  }
  const geoData = await reverseGeo({ coordinates: [longitude, latitude] });
  const country = geoData.address.country || 'Unknown';
  return country;
};

export const getNearestCityFromCoordinates = async ({
  latitude, 
  longitude
}) => {
  if (typeof window !== 'undefined') {
    throw new Error('getNearestCityFromCoordinates is not available in browser environments');
  }
  const geoData = await reverseGeo({ coordinates: [longitude, latitude] });
  const city = geoData.address.city || geoData.address.town || geoData.address.village || 'Unknown';
  return city;
};

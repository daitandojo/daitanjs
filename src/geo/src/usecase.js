import { forwardGeo, reverseGeo, calcDistance, latLngToGeohash, geohashToLatLng, getCountryFromCoordinates, getNearestCityFromCoordinates, calculateBoundingBox, generateRandomPoint, calculateMidpoint, isPointInBoundingBox, findNearbyPoints, coordinatesToAddress, addressToCoordinates } from './mapbox.js';

const useCase = async () => {
  try {
    // Example 1: Forward Geocoding
    const forwardResults = await forwardGeo("Nootdorp");
    const coordinates = forwardResults[0].geometry.coordinates;
    console.log(`Coordinates for Nootdorp: ${coordinates}`);

    // Example 2: Reverse Geocoding
    const reverseResult = await reverseGeo(coordinates);
    console.log(`Place name for coordinates ${coordinates}: ${reverseResult.place_name}`);

    // Example 3: Calculate Distance
    const distance = await calcDistance(coordinates, [4.895167, 52.370216]); // Coordinates of Amsterdam
    console.log(`Distance between Nootdorp and Amsterdam: ${distance} km`);

    // Example 4: Convert to and from Geohash
    const geohash = latLngToGeohash(coordinates[1], coordinates[0]);
    console.log(`Geohash for Nootdorp: ${geohash}`);
    const decodedCoordinates = geohashToLatLng(geohash);
    console.log(`Decoded coordinates from geohash: ${decodedCoordinates}`);

    // Example 5: Get Country from Coordinates
    const country = await getCountryFromCoordinates(coordinates[1], coordinates[0]);
    console.log(`Country for coordinates ${coordinates}: ${country}`);

    // Example 6: Get Nearest City from Coordinates
    const nearestCity = await getNearestCityFromCoordinates(coordinates[1], coordinates[0]);
    console.log(`Nearest city to coordinates ${coordinates}: ${nearestCity}`);

    // Example 7: Calculate Bounding Box
    const boundingBox = calculateBoundingBox(coordinates[1], coordinates[0], 10); // 10 km radius
    console.log(`Bounding box for 10 km radius around Nootdorp:`, boundingBox);

    // Example 8: Generate Random Point within Bounding Box
    const randomPoint = generateRandomPoint(boundingBox);
    console.log(`Random point within bounding box: ${randomPoint}`);

    // Example 9: Calculate Midpoint between two coordinates
    const midpoint = calculateMidpoint(coordinates, [4.895167, 52.370216]); // Coordinates of Amsterdam
    console.log(`Midpoint between Nootdorp and Amsterdam: ${midpoint}`);

    // Example 10: Check if a Point is within Bounding Box
    const isWithinBoundingBox = isPointInBoundingBox(randomPoint, boundingBox);
    console.log(`Is random point within bounding box: ${isWithinBoundingBox}`);

    // Example 11: Find Nearby Points within Radius
    const nearbyPoints = findNearbyPoints({latitude: coordinates[1], longitude: coordinates[0]}, [{latitude: 52.370216, longitude: 4.895167}], 60); // 60 km radius
    console.log(`Nearby points within 60 km radius: ${nearbyPoints}`);

    // Example 12: Convert Coordinates to Address
    const address = await coordinatesToAddress(coordinates[1], coordinates[0]);
    console.log(`Address for coordinates ${coordinates}: ${address}`);

    // Example 13: Convert Address to Coordinates
    const coordsFromAddress = await addressToCoordinates("Dam Square, Amsterdam");
    console.log(`Coordinates for Dam Square, Amsterdam: ${coordsFromAddress}`);
  } catch (error) {
    console.error(`Error in geolocation operations: ${error.message}`);
  }
};

// Run the use case
useCase();

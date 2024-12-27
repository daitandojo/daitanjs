import { query } from './index.js';

// Example usage: Fetch a random cat fact from the Cat Facts API
const url = 'https://catfact.ninja/fact';

// Call the query function with appropriate parameters
(async () => {
  try {
    const response = await query({
      method: 'GET', 
      url
    });
    console.log('Response:', response);
  } catch (error) {
    console.error('Error during API call:', error);
  }
})();

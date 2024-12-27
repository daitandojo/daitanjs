/**
 * Default configuration for fetch requests.
 */
const defaultConfig = {
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
  credentials: 'include', // equivalent to withCredentials: true
};

/**
 * Makes an HTTP request using fetch.
 *
 * @param {Object} config - The fetch request configuration.
 * @returns {Promise<Object>} - A promise that resolves to the JSON response.
 * @throws {Error} - Throws an error if the request fails or the response is not valid JSON.
 */
const query = async (config) => {
  
  console.log(`Query request passed on to: ${config.url}`);
  
  const fetchConfig = {
    ...defaultConfig,
    ...config,
    method: config.method || (config.data ? 'POST' : 'GET'),
  };

  if (config.data) {
    fetchConfig.body = JSON.stringify(config.data);
  }

  try {
    const response = await fetch(config.url, fetchConfig);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`[API] Error in ${fetchConfig.method} ${config.url}:`, error);
    throw error;
  }
};

// Convenience methods for common HTTP verbs
const get = (url, config = {}) => query({ ...config, method: 'GET', url });
const post = (url, data, config = {}) => query({ ...config, method: 'POST', url, data });
const put = (url, data, config = {}) => query({ ...config, method: 'PUT', url, data });
const del = (url, config = {}) => query({ ...config, method: 'DELETE', url });

export {
  query,
  get,
  post,
  put,
  del
};
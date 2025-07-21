// File: src/intelligence/core/ollamaUtils.js
import axios from 'axios';
import { getLogger } from '@daitanjs/development';

const logger = getLogger('ollama-utils'); // Or your preferred logger setup

/**
 * Checks if the Ollama server is reachable and responsive.
 * @param {string} baseURL - The base URL of the Ollama server (e.g., http://localhost:11434).
 * @returns {Promise<boolean>} True if the server is running, false otherwise.
 */
export const checkOllamaStatus = async (baseURL) => {
  if (!baseURL) {
    logger.warn('checkOllamaStatus: No baseURL provided for Ollama server.');
    return false;
  }
  try {
    // A simple GET request to the root of Ollama server usually returns "Ollama is running" or a similar confirmation.
    // For a more robust check, one might target a specific endpoint like `/api/tags` if unauthenticated access is allowed,
    // but a simple root check is often sufficient to see if the server is up.
    const response = await axios.get(baseURL, { timeout: 2000 }); // 2-second timeout
    // Check for a successful status code and potentially specific text if needed.
    if (
      response.status === 200 &&
      response.data &&
      typeof response.data === 'string' &&
      response.data.toLowerCase().includes('ollama is running')
    ) {
      logger.debug(`Ollama server at ${baseURL} is responsive.`);
      return true;
    } else if (response.status === 200) {
      // Some Ollama versions might just return 200 OK on base URL without specific text
      logger.debug(
        `Ollama server at ${baseURL} responded with status 200. Assuming responsive.`
      );
      return true;
    }
    logger.warn(
      `Ollama server at ${baseURL} responded with status ${response.status} but unexpected content.`
    );
    return false;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      // logger.debug(`Ollama server at ${baseURL} not reachable: ${error.message}`);
    } else {
      logger.error(
        `An unexpected error occurred while checking Ollama status at ${baseURL}: ${error.message}`
      );
    }
    return false;
  }
};

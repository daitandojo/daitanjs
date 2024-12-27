import os from 'os';

/**
 * Checks if the current CPU is supported for TensorFlow operations.
 * @returns {boolean} Whether the CPU is supported.
 */
export const isTensorFlowSupported = () => {
  const cpuModel = os.cpus()[0].model;
  const unsupportedCPUs = ["Intel(R) Celeron(R) J4105 CPU @ 1.50GHz"];
  return !unsupportedCPUs.some((model) => cpuModel.includes(model));
};

/**
 * Calculates the dot product of two vectors.
 * @param {number[]} a - First vector.
 * @param {number[]} b - Second vector.
 * @returns {number} The dot product of the two vectors.
 */
export const dotProduct = (a, b) => {
  return a.reduce((sum, value, index) => sum + value * b[index], 0);
};

/**
 * Calculates the magnitude of a vector.
 * @param {number[]} vector - The vector.
 * @returns {number} The magnitude of the vector.
 */
export const magnitude = (vector) => {
  return Math.sqrt(vector.reduce((sum, value) => sum + value ** 2, 0));
};

/**
 * Calculates the cosine similarity between two vectors.
 * @param {number[]} a - First vector.
 * @param {number[]} b - Second vector.
 * @returns {number} Cosine similarity between the two vectors.
 */
export const cosineSimilarity = (a, b) => {
  return dotProduct(a, b) / (magnitude(a) * magnitude(b));
};

/**
 * Basic logger using `console` for simplicity.
 * @param {string} context - The context for the logger.
 * @returns {object} A logger with info, error, and debug methods.
 */
export const getLogger = (context) => ({
  info: (message) => console.log(`[INFO] [${context}] ${message}`),
  error: (message) => console.error(`[ERROR] [${context}] ${message}`),
  debug: (message) => console.debug(`[DEBUG] [${context}] ${message}`),
});

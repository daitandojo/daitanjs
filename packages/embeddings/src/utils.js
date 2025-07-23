// embeddings/src/utils.js
/**
 * @file Utility functions for embedding operations, including math helpers and TensorFlow support checks.
 * @module @daitanjs/embeddings/utils
 *
 * @description
 * This module provides core mathematical utilities often used with embedding vectors,
 * such as dot product, magnitude calculation, and cosine similarity. It also re-exports
 * the `isTensorFlowSupported` check from `@daitanjs/development` for convenience within
 * the embeddings package, as TensorFlow.js Node can be leveraged for optimized
 * embedding similarity searches if the environment supports it.
 */
import {
  getLogger,
  isTensorFlowSupported as isTfJsNodeSupportedFromDev, // Import canonical check
} from '@daitanjs/development';
import { DaitanInvalidInputError } from '@daitanjs/error'; // For input validation errors

const embeddingsUtilLogger = getLogger('daitan-embeddings-utils');

/**
 * Re-export of the canonical TensorFlow.js Node support check from `@daitanjs/development`.
 * This function checks if the current CPU is likely to support TensorFlow.js Node
 * operations, which can be used for optimized embedding calculations.
 *
 * @public
 * @returns {boolean} True if TensorFlow.js Node is likely supported, false otherwise.
 */
export const isTensorFlowSupported = () => {
  const supported = isTfJsNodeSupportedFromDev();
  // embeddingsUtilLogger.debug(`isTensorFlowSupported (re-export): Result = ${supported}`); // Can be noisy, log if needed
  return supported;
};

/**
 * Calculates the dot product of two numerical vectors (arrays of numbers).
 * Both vectors must be non-empty and have the same length.
 *
 * @public
 * @param {number[]} vectorA - The first vector.
 * @param {number[]} vectorB - The second vector.
 * @returns {number} The dot product of `vectorA` and `vectorB`.
 * @throws {DaitanInvalidInputError} If inputs are not valid arrays of numbers of the same length, or are empty.
 */
export const dotProduct = (vectorA, vectorB) => {
  if (!Array.isArray(vectorA) || !Array.isArray(vectorB)) {
    throw new DaitanInvalidInputError(
      'Both inputs for dot product must be arrays.'
    );
  }
  if (vectorA.length === 0) {
    // vectorB.length === 0 covered by length check
    throw new DaitanInvalidInputError(
      'Vectors for dot product cannot be empty.'
    );
  }
  if (vectorA.length !== vectorB.length) {
    throw new DaitanInvalidInputError(
      `Vectors must have the same length for dot product. Got lengths ${vectorA.length} and ${vectorB.length}.`
    );
  }

  let product = 0;
  for (let i = 0; i < vectorA.length; i++) {
    if (
      typeof vectorA[i] !== 'number' ||
      typeof vectorB[i] !== 'number' ||
      !isFinite(vectorA[i]) ||
      !isFinite(vectorB[i])
    ) {
      throw new DaitanInvalidInputError(
        `All vector elements must be finite numbers for dot product. Found invalid element at index ${i}.`
      );
    }
    product += vectorA[i] * vectorB[i];
  }
  return product;
};

/**
 * Calculates the magnitude (Euclidean norm or L2 norm) of a numerical vector.
 * The vector must be non-empty and contain only finite numbers.
 *
 * @public
 * @param {number[]} vector - The vector for which to calculate the magnitude.
 * @returns {number} The magnitude of the vector.
 * @throws {DaitanInvalidInputError} If the input is not a valid non-empty array of finite numbers.
 */
export const magnitude = (vector) => {
  if (!Array.isArray(vector)) {
    throw new DaitanInvalidInputError(
      'Input for magnitude calculation must be an array.'
    );
  }
  if (vector.length === 0) {
    throw new DaitanInvalidInputError(
      'Cannot calculate magnitude of an empty vector.'
    );
  }

  let sumOfSquares = 0;
  for (let i = 0; i < vector.length; i++) {
    if (typeof vector[i] !== 'number' || !isFinite(vector[i])) {
      throw new DaitanInvalidInputError(
        `All vector elements must be finite numbers to calculate magnitude. Found invalid element at index ${i}.`
      );
    }
    sumOfSquares += vector[i] * vector[i];
  }
  return Math.sqrt(sumOfSquares);
};

/**
 * Calculates the cosine similarity between two numerical vectors.
 * Cosine similarity measures the cosine of the angle between two non-zero vectors,
 * indicating their orientation similarity. It ranges from -1 (exactly opposite)
 * to 1 (exactly the same direction), with 0 indicating orthogonality.
 *
 * Returns `NaN` if either vector has zero magnitude (as cosine similarity is undefined in such cases).
 *
 * @public
 * @param {number[]} vectorA - The first vector.
 * @param {number[]} vectorB - The second vector.
 * @returns {number} The cosine similarity, a value between -1 and 1 (inclusive), or `NaN` if undefined.
 * @throws {DaitanInvalidInputError} If inputs are invalid for dot product or magnitude calculations (propagated).
 */
export const cosineSimilarity = (vectorA, vectorB) => {
  // dotProduct and magnitude will throw DaitanInvalidInputError on invalid inputs.
  const dot = dotProduct(vectorA, vectorB);
  const magA = magnitude(vectorA);
  const magB = magnitude(vectorB);

  if (magA === 0 || magB === 0) {
    embeddingsUtilLogger.debug(
      'Cosine similarity is undefined (returning NaN) because one or both vector magnitudes are zero.',
      {
        magA,
        magB,
        vectorALength: vectorA?.length,
        vectorBLength: vectorB?.length,
      }
    );
    return NaN; // Cosine similarity is undefined if one or both vectors are zero vectors.
    // Returning 0 might be another option depending on how downstream code handles it.
  }
  const similarity = dot / (magA * magB);
  // Clip to [-1, 1] to handle potential floating point inaccuracies for nearly identical/opposite vectors
  return Math.max(-1, Math.min(1, similarity));
};

// The original basic getLogger from this file was removed in previous refactoring steps,
// as the standardized getLogger is imported from @daitanjs/development.

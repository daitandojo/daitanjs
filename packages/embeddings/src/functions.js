// embeddings/src/functions.js
/**
 * @file Mathematical functions for manipulating and analyzing embedding vectors.
 * @module @daitanjs/embeddings/functions
 *
 * @description
 * This module provides functions for common operations on embedding vectors, such as:
 * - Averaging multiple embeddings.
 * - Interpolating between two embeddings.
 * - Dimensionality reduction using PCA (Principal Component Analysis) via `ml-pca`,
 *   primarily for visualization purposes (e.g., reducing to 2D or 3D).
 * - Clustering embeddings using k-means algorithm via `ml-kmeans`.
 *
 * These functions are useful for tasks like creating aggregate embeddings, exploring
 * semantic similarities, or grouping related items based on their vector representations.
 * Input validation is performed to ensure embeddings are in the correct format (arrays of numbers).
 */
import { PCA } from 'ml-pca';
import { kmeans as mlKmeansAlgorithm } from 'ml-kmeans'; // Aliased to avoid naming conflict if a local 'kmeans' var is used
import { getLogger } from '@daitanjs/development';
import { DaitanInvalidInputError, DaitanOperationError } from '@daitanjs/error';

const embeddingFunctionsLogger = getLogger('daitan-embeddings-functions');

/**
 * Validates if the input is a valid array of embedding vectors (arrays of numbers).
 * @private
 * @param {any} embeddings - The input to validate.
 * @param {string} callingFunctionName - Name of the public function calling this validator, for error messages.
 * @param {object} [options={}] - Validation options.
 * @param {boolean} [options.requireSameDimension=true] - If true, checks if all vectors have the same dimension.
 * @param {number} [options.minArrayLength=1] - Minimum number of embedding vectors required in the input array.
 * @param {number} [options.minVectorDimension=1] - Minimum dimension (length) for each individual embedding vector.
 * @returns {number[][]} The validated embeddings array (throws DaitanInvalidInputError on failure).
 */
const validateEmbeddingsArrayInternal = (embeddings, callingFunctionName, options = {}) => {
  const {
    requireSameDimension = true,
    minArrayLength = 1,
    minVectorDimension = 1,
  } = options;

  if (!Array.isArray(embeddings) || embeddings.length < minArrayLength) {
    throw new DaitanInvalidInputError(
      `${callingFunctionName}: Input must be an array containing at least ${minArrayLength} embedding vector(s). Received type: ${typeof embeddings}, length: ${embeddings?.length}.`
    );
  }

  let firstDimension = -1;
  for (let i = 0; i < embeddings.length; i++) {
    const vector = embeddings[i];
    if (!Array.isArray(vector) || vector.length < minVectorDimension) {
      throw new DaitanInvalidInputError(
        `${callingFunctionName}: Embedding at index ${i} is not a valid array or its dimension (${vector?.length}) is less than minimum required (${minVectorDimension}).`
      );
    }
    if (!vector.every(el => typeof el === 'number' && isFinite(el))) {
      throw new DaitanInvalidInputError(
        `${callingFunctionName}: Embedding at index ${i} contains non-numeric or non-finite (NaN, Infinity) values.`
      );
    }
    if (requireSameDimension) {
      if (i === 0) {
        firstDimension = vector.length;
      } else if (vector.length !== firstDimension) {
        throw new DaitanInvalidInputError(
          `${callingFunctionName}: Embeddings must all have the same dimension. Expected ${firstDimension} (from vector at index 0), but found dimension ${vector.length} at index ${i}.`
        );
      }
    }
  }
  return embeddings; // Return the validated array (original reference)
};

/**
 * Calculates the element-wise average of a list of embedding vectors.
 * All input vectors must have the same dimension.
 *
 * @public
 * @param {number[][]} embeddings - An array of embedding vectors (each vector is an array of numbers).
 * @returns {number[]} The resulting average embedding vector. Returns an empty array if the input `embeddings` array is empty.
 * @throws {DaitanInvalidInputError} If input is not an array, is empty (and minLength > 0 was implied by use),
 *         contains non-numeric elements, or if vectors have different lengths.
 */
export const averageEmbeddings = (embeddings) => {
  const callId = `avgEmbed-${Date.now().toString(36)}`;
  embeddingFunctionsLogger.debug(`[${callId}] averageEmbeddings: Called.`, { numEmbeddings: embeddings?.length });

  // Allow empty array input, in which case an empty array is a valid result. minArrayLength=0.
  const validatedEmbeddings = validateEmbeddingsArrayInternal(embeddings, 'averageEmbeddings', {
    requireSameDimension: true,
    minArrayLength: 0, // Allow empty array, which will return []
    minVectorDimension: 1, // If not empty, vectors must have dimension
  });

  if (validatedEmbeddings.length === 0) {
    embeddingFunctionsLogger.info('[${callId}] averageEmbeddings: Input embeddings array is empty, returning empty array.');
    return [];
  }

  const numVectors = validatedEmbeddings.length;
  const vectorDimension = validatedEmbeddings[0].length;
  const sumVector = new Array(vectorDimension).fill(0);

  for (const vector of validatedEmbeddings) {
    for (let i = 0; i < vectorDimension; i++) {
      sumVector[i] += vector[i];
    }
  }

  const averageVector = sumVector.map(val => val / numVectors);
  embeddingFunctionsLogger.debug(`[${callId}] averageEmbeddings: Successfully calculated average.`, {
    resultDim: averageVector.length,
    firstFewValues: averageVector.slice(0, 3),
  });
  return averageVector;
};

/**
 * Performs linear interpolation between two embedding vectors.
 * `result = (1 - alpha) * embedding1 + alpha * embedding2`
 * Both input embeddings must have the same dimension.
 *
 * @public
 * @param {number[]} embedding1 - The first embedding vector (array of numbers).
 * @param {number[]} embedding2 - The second embedding vector (array of numbers).
 * @param {number} [alpha=0.5] - The interpolation factor, typically between 0 and 1.
 *        - `alpha = 0` returns `embedding1`.
 *        - `alpha = 1` returns `embedding2`.
 *        - `alpha = 0.5` returns the midpoint.
 *        Values outside [0, 1] will extrapolate.
 * @returns {number[]} The interpolated embedding vector.
 * @throws {DaitanInvalidInputError} If inputs are invalid (not arrays, different lengths, non-numeric elements).
 */
export const interpolateEmbeddings = (embedding1, embedding2, alpha = 0.5) => {
  const callId = `interpEmbed-${Date.now().toString(36)}`;
  embeddingFunctionsLogger.debug(`[${callId}] interpolateEmbeddings: Called.`, {
    alpha, e1Len: embedding1?.length, e2Len: embedding2?.length,
  });

  // Validate each embedding individually first
  validateEmbeddingsArrayInternal([embedding1], 'interpolateEmbeddings (embedding1)', { requireSameDimension: false, minArrayLength: 1 });
  validateEmbeddingsArrayInternal([embedding2], 'interpolateEmbeddings (embedding2)', { requireSameDimension: false, minArrayLength: 1 });

  if (embedding1.length !== embedding2.length) {
    throw new DaitanInvalidInputError(
      `interpolateEmbeddings: Embeddings must be of the same length for interpolation. Got lengths ${embedding1.length} and ${embedding2.length}.`
    );
  }
  if (typeof alpha !== 'number' || !isFinite(alpha)) {
    throw new DaitanInvalidInputError('interpolateEmbeddings: Alpha must be a finite number.');
  }
  if (alpha < 0 || alpha > 1) {
    embeddingFunctionsLogger.warn(`[${callId}] interpolateEmbeddings: Alpha (${alpha}) is outside the typical [0, 1] range, resulting in extrapolation.`);
  }

  const interpolatedVector = embedding1.map(
    (val, i) => val * (1 - alpha) + embedding2[i] * alpha
  );
  embeddingFunctionsLogger.debug(`[${callId}] interpolateEmbeddings: Successfully interpolated.`, {
    resultDim: interpolatedVector.length,
    firstFewValues: interpolatedVector.slice(0, 3),
  });
  return interpolatedVector;
};

/**
 * Reduces the dimensionality of an array of embedding vectors using Principal Component Analysis (PCA).
 * This is often used for visualization (e.g., reducing to 2D or 3D).
 * Uses the `ml-pca` library.
 *
 * @public
 * @param {number[][]} embeddings - An array of high-dimensional embedding vectors. All vectors must have the same dimension.
 * @param {number} [targetDimensions=2] - The number of principal components (dimensions) to reduce to.
 *                                        Must be positive, less than the original dimension, and less than or equal to the number of samples.
 * @param {object} [pcaOptions={}] - Options for `ml-pca` constructor (e.g., `scale`, `useCovarianceMatrix`).
 * @returns {number[][]} An array of reduced-dimension embedding vectors. Each inner array will have length `targetDimensions`.
 * @throws {DaitanInvalidInputError} If input `embeddings` are invalid, or `targetDimensions` is not suitable
 *         (e.g., not positive, >= original dimension, or > number of samples).
 * @throws {DaitanOperationError} If PCA computation fails (e.g., due to issues in `ml-pca` library or singular matrix).
 */
export const visualizeEmbeddings = (embeddings, targetDimensions = 2, pcaOptions = {}) => {
  const callId = `pcaEmbed-${Date.now().toString(36)}`;
  embeddingFunctionsLogger.debug(`[${callId}] visualizeEmbeddings (PCA): Called.`, {
    numEmbeddings: embeddings?.length, targetDimensions,
  });

  // Validate embeddings: must be at least one, all same length, numeric.
  // For PCA, number of samples should be >= number of features (originalDim) if not reducing,
  // and > targetDimensions for meaningful reduction.
  const validatedEmbeddings = validateEmbeddingsArrayInternal(embeddings, 'visualizeEmbeddings (PCA)', {
    requireSameDimension: true,
    minArrayLength: 1, // Need at least one sample
    minVectorDimension: 1,
  });

  if (validatedEmbeddings.length === 0) { // Should be caught by minArrayLength:1 but as safeguard
    embeddingFunctionsLogger.warn('[${callId}] visualizeEmbeddings (PCA): Input embeddings array is empty. Returning empty array.');
    return [];
  }

  const numSamples = validatedEmbeddings.length;
  const originalDim = validatedEmbeddings[0].length;

  if (!Number.isInteger(targetDimensions) || targetDimensions <= 0) {
    throw new DaitanInvalidInputError(`visualizeEmbeddings (PCA): targetDimensions (${targetDimensions}) must be a positive integer.`);
  }
  if (targetDimensions >= originalDim) {
    throw new DaitanInvalidInputError(
      `visualizeEmbeddings (PCA): targetDimensions (${targetDimensions}) must be less than the original dimension (${originalDim}).`
    );
  }
  if (numSamples <= targetDimensions && numSamples > 1) { // ml-pca might allow numSamples === targetDimensions for some cases, but generally numSamples > targetDimensions
    embeddingFunctionsLogger.warn(
      `[${callId}] visualizeEmbeddings (PCA): Number of samples (${numSamples}) is less than or equal to targetDimensions (${targetDimensions}). PCA results might be unstable or trivial. ` +
      `Consider more samples or fewer target dimensions.`
    );
    // Depending on ml-pca behavior, this might still work or throw. Let it try.
  }
   if (numSamples === 1 && targetDimensions > 0) {
       throw new DaitanInvalidInputError(
           `visualizeEmbeddings (PCA): Cannot perform PCA with only one sample to reduce to ${targetDimensions} dimensions.`
       );
   }


  try {
    const pca = new PCA(validatedEmbeddings, {
      scale: pcaOptions.scale || false, // Default to no scaling, often embeddings are already normalized or scale is meaningful
      useCovarianceMatrix: pcaOptions.useCovarianceMatrix || false, // Default to using correlation matrix if scale is true
      ...pcaOptions, // Allow overriding all ml-pca options
    });

    // `predict` in ml-pca applies the transformation. `nComponents` specifies how many to return.
    const reducedEmbeddingMatrix = pca.predict(validatedEmbeddings, { nComponents: targetDimensions });
    const reducedEmbeddingsArray = reducedEmbeddingMatrix.to2DArray(); // Convert from ml-matrix to standard array of arrays

    embeddingFunctionsLogger.info(
      `[${callId}] visualizeEmbeddings (PCA): Successfully reduced ${numSamples} embeddings from ${originalDim}D to ${targetDimensions}D.`
    );
    if (embeddingFunctionsLogger.isLevelEnabled('debug') && reducedEmbeddingsArray.length > 0) {
        embeddingFunctionsLogger.debug(`[${callId}] Explained variance ratio by component:`, pca.getExplainedVariance().slice(0, targetDimensions));
        embeddingFunctionsLogger.debug(`[${callId}] First reduced vector sample:`, reducedEmbeddingsArray[0]);
    }
    return reducedEmbeddingsArray;
  } catch (error) {
    embeddingFunctionsLogger.error(`[${callId}] visualizeEmbeddings (PCA): Error during PCA computation: ${error.message}`, {
      errorName: error.name, originalDim, targetDimensions, numSamples
    });
    throw new DaitanOperationError(`PCA dimensionality reduction failed: ${error.message}`, { originalDim, targetDimensions, numSamples }, error);
  }
};

/**
 * Clusters an array of embedding vectors using the k-means algorithm.
 * Uses the `ml-kmeans` library.
 *
 * @public
 * @param {number[][]} embeddings - An array of embedding vectors. All vectors must have the same dimension.
 * @param {number} [numClusters=5] - The desired number of clusters (k).
 * @param {object} [kmeansOptions={}] - Options for the `ml-kmeans` algorithm.
 *        Common options: `maxIterations` (default 100), `tolerance` (default 1e-4),
 *        `seed` (for reproducibility), `distanceFunction` (default Euclidean).
 *        See `ml-kmeans` documentation for all options.
 * @returns {import('ml-kmeans').KMeansResult} The result object from `ml-kmeans`, containing:
 *          - `clusters` (number[]): Array of cluster indices (0 to k-1) for each input embedding.
 *          - `centroids` (number[][]): Array of centroid vectors for each cluster.
 *          - `iterations` (number): Number of iterations performed by the algorithm.
 *          - `converged` (boolean): True if the algorithm converged within `maxIterations`.
 * @throws {DaitanInvalidInputError} If input `embeddings` are invalid, or `numClusters` is not suitable.
 * @throws {DaitanOperationError} If k-means computation fails (e.g., due to issues in `ml-kmeans`).
 */
export const clusterEmbeddings = (embeddings, numClusters = 5, kmeansOptions = {}) => {
  const callId = `kmeansEmbed-${Date.now().toString(36)}`;
  embeddingFunctionsLogger.debug(`[${callId}] clusterEmbeddings (k-means): Called.`, {
    numEmbeddings: embeddings?.length, numClusters,
  });

  // k-means requires at least `numClusters` samples.
  const validatedEmbeddings = validateEmbeddingsArrayInternal(embeddings, 'clusterEmbeddings (k-means)', {
    requireSameDimension: true,
    minArrayLength: 1, // At least one sample needed
    minVectorDimension: 1,
  });

  if (validatedEmbeddings.length === 0) { // Should be caught by minArrayLength:1
    throw new DaitanInvalidInputError('clusterEmbeddings (k-means): Input embeddings array cannot be empty.');
  }
  if (!Number.isInteger(numClusters) || numClusters <= 0) {
    throw new DaitanInvalidInputError(`clusterEmbeddings (k-means): numClusters (${numClusters}) must be a positive integer.`);
  }
  if (validatedEmbeddings.length < numClusters) {
    // ml-kmeans might throw an error or produce trivial clusters.
    // It's better to catch this condition early.
    throw new DaitanInvalidInputError(
      `clusterEmbeddings (k-means): Number of embeddings (${validatedEmbeddings.length}) must be greater than or equal to numClusters (${numClusters}).`
    );
  }

  const defaultKmeansOptions = {
    maxIterations: 100, // Default from ml-kmeans
    tolerance: 1e-4,    // Default from ml-kmeans
    // seed: undefined, // Set for reproducible results, e.g., Date.now() or a fixed number
    // distanceFunction: (a, b) => euclideanDistanceSquared(a,b) // Default in ml-kmeans
    ...kmeansOptions, // Allow user to override all ml-kmeans options
  };
  if (defaultKmeansOptions.seed === undefined && embeddingFunctionsLogger.isLevelEnabled('debug')) {
      embeddingFunctionsLogger.debug(`[${callId}] k-means: No seed provided, results may vary on different runs.`);
  }


  try {
    const result = mlKmeansAlgorithm(validatedEmbeddings, numClusters, defaultKmeansOptions);
    embeddingFunctionsLogger.info(
      `[${callId}] clusterEmbeddings (k-means): Successfully clustered ${validatedEmbeddings.length} embeddings into ${numClusters} clusters. ` +
      `Iterations: ${result.iterations}, Converged: ${result.converged}.`
    );
    if (embeddingFunctionsLogger.isLevelEnabled('debug')) {
        const clusterCounts = result.clusters.reduce((acc, cIdx) => { acc[cIdx] = (acc[cIdx] || 0) + 1; return acc; }, {});
        embeddingFunctionsLogger.debug(`[${callId}] Cluster distribution:`, clusterCounts);
        embeddingFunctionsLogger.debug(`[${callId}] First centroid sample:`, result.centroids[0]?.slice(0,3));
    }
    return result;
  } catch (error) {
    embeddingFunctionsLogger.error(`[${callId}] clusterEmbeddings (k-means): Error during k-means computation: ${error.message}`, {
      errorName: error.name, numSamples: validatedEmbeddings.length, numClusters,
    });
    throw new DaitanOperationError(`K-means clustering failed: ${error.message}`, { numSamples: validatedEmbeddings.length, numClusters }, error);
  }
};
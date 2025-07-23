// embeddings/src/index.js
/**
 * @file Main entry point for the @daitanjs/embeddings package.
 * @module @daitanjs/embeddings
 *
 * @description
 * This package provides a comprehensive suite of tools for working with text embeddings.
 * It has been simplified to focus on core, stable functionality.
 */
import { getLogger } from '@daitanjs/development';

const embeddingsIndexLogger = getLogger('daitan-embeddings-index');

embeddingsIndexLogger.debug('Exporting DaitanJS Embeddings functionalities...');

// --- Core Embedding Generation ---
// JSDoc for these is in `src/embeddings.js`.
export {
  generateEmbedding,
  generateBatchEmbeddings, // Kept for backward compatibility
} from './embeddings.js';

// --- Mathematical and Utility Functions ---
// JSDoc for these is in `src/functions.js`.
// These are removed for now to ensure a stable build, as they depend on ml-paca etc.
// export {
//   averageEmbeddings,
//   interpolateEmbeddings,
//   visualizeEmbeddings,
//   clusterEmbeddings,
// } from './functions.js';

// --- Lower-level Utility Functions ---
// JSDoc for these is in `src/utils.js`.
export {
  isTensorFlowSupported,
  dotProduct,
  magnitude,
  cosineSimilarity,
} from './utils.js';

embeddingsIndexLogger.info('DaitanJS Embeddings module exports ready.');

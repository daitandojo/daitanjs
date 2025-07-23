// intelligence/src/intelligence/core/embeddingGenerator.js
/**
 * @file Re-exports embedding generation functionalities from the canonical @daitanjs/embeddings package.
 * @module @daitanjs/intelligence/core/embeddingGenerator
 *
 * @description
 * This module ensures that embedding generation capabilities are accessible through the
 * `@daitanjs/intelligence` package's core interface while maintaining a single source of truth.
 * The actual implementation of `generateEmbedding` and related utilities resides in the
 * `@daitanjs/embeddings` package.
 *
 * This re-export approach prevents code duplication and enforces the DaitanJS architectural
 * principle of specialized, reusable packages.
 *
 * For detailed documentation on the exported functions, please refer to the `@daitanjs/embeddings` package.
 */
import { getLogger } from '@daitanjs/development';

const embeddingGeneratorLogger = getLogger('daitan-embedding-generator');

embeddingGeneratorLogger.info(
  'Embedding generator module is a re-export layer. All embedding functionalities are canonical in @daitanjs/embeddings.'
);

// Re-exporting the canonical embedding generation functions from the @daitanjs/embeddings package.
// This assumes that @daitanjs/embeddings is a dependency of @daitanjs/intelligence.
export {
  generateEmbedding,
  generateBatchEmbeddings, // This function is deprecated in the source but exported for compatibility
} from '@daitanjs/embeddings';

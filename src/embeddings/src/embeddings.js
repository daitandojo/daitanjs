// embeddings/src/embeddings.js
/**
 * @file [STABLE REWRITE] Core functionalities for generating embeddings.
 * @module @daitanjs/embeddings/embeddings
 * @description This file has been radically simplified to remove complex dependencies (ml-pca, ml-kmeans, tensorflow)
 * that were causing build corruption. Its sole purpose is now to provide a stable, reliable
 * interface for generating embeddings via the OpenAI API.
 */
import { getLogger } from '@daitanjs/development';
import { getConfigManager } from '@daitanjs/config';
import {
  DaitanConfigurationError,
  DaitanOperationError,
  DaitanInvalidInputError,
  DaitanError,
} from '@daitanjs/error';
import { query as apiQuery } from '@daitanjs/apiqueries';

const embeddingsServiceLogger = getLogger('daitan-embeddings-service');

const embeddingRequestCache = new Map();
const DEFAULT_EMBEDDING_CACHE_MAX_SIZE = 1000;

/**
 * @typedef {Object} EmbeddingGenerationResult
 * @property {number[] | number[][]} embedding - The generated embedding vector or array of vectors.
 * @property {string} modelUsed - The actual embedding model that was used.
 * @property {object} [usage] - Token usage information from the API.
 */

/**
 * @typedef {Object} EmbeddingConfig
 * @property {string} [target] - The target embedding model, specified as 'provider|model' (e.g., 'openai|text-embedding-3-small').
 * @property {string} [apiKey] - Explicit API key for the provider.
 * @property {boolean} [useCache] - Enable/disable caching for this call.
 */

/**
 * @typedef {Object} GenerateEmbeddingParams
 * @property {string | string[]} input - A single string or an array of strings to embed.
 * @property {EmbeddingConfig} [config={}] - Configuration for the embedding generation call.
 */

/**
 * Generates embeddings for a single input string or an array of strings.
 */
export const generateEmbedding = async ({ input, config = {} }) => {
  const configManager = getConfigManager();
  const isBatch = Array.isArray(input);

  if (
    (isBatch &&
      (input.length === 0 ||
        !input.every((item) => typeof item === 'string' && item.trim()))) ||
    (!isBatch && (typeof input !== 'string' || !input.trim()))
  ) {
    throw new DaitanInvalidInputError(
      'Input for embedding must be a non-empty string or a non-empty array of non-empty strings.'
    );
  }

  const {
    target,
    apiKey: explicitApiKey,
    useCache: callSpecificUseCache,
  } = config;

  const [providerKey, modelName] = (target || 'openai|').split('|');
  if (providerKey.toLowerCase().trim() !== 'openai') {
    throw new DaitanConfigurationError(
      `Unsupported embedding provider: "${providerKey}". Currently, only "openai" is supported.`
    );
  }

  const effectiveModel =
    modelName?.trim() ||
    configManager.get('OPENAI_EMBEDDING_MODEL') ||
    'text-embedding-3-small';
  const apiKey = explicitApiKey || configManager.get('OPENAI_API_KEY');
  if (!apiKey) {
    throw new DaitanConfigurationError(
      'OpenAI API key (OPENAI_API_KEY) is not configured for embeddings.'
    );
  }

  const effectiveUseCache =
    callSpecificUseCache ?? configManager.get('EMBEDDING_USE_CACHE', true);
  const cacheKey =
    effectiveUseCache && !isBatch ? `${input}_${effectiveModel}` : null;

  if (cacheKey && embeddingRequestCache.has(cacheKey)) {
    return {
      embedding: embeddingRequestCache.get(cacheKey),
      modelUsed: effectiveModel,
      usage: null,
    };
  }

  try {
    const responseData = await apiQuery({
      url: 'https://api.openai.com/v1/embeddings',
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      data: { input: isBatch ? input : [input], model: effectiveModel },
      summary: `OpenAI Embedding: Model ${effectiveModel}`,
    });

    if (!responseData?.data?.[0]?.embedding) {
      throw new DaitanOperationError(
        'Invalid response structure from OpenAI Embeddings API.'
      );
    }

    const embeddingsList = responseData.data.map((item) => item.embedding);
    const resultEmbedding = isBatch ? embeddingsList : embeddingsList[0];

    if (cacheKey) {
      if (embeddingRequestCache.size >= DEFAULT_EMBEDDING_CACHE_MAX_SIZE) {
        embeddingRequestCache.delete(embeddingRequestCache.keys().next().value);
      }
      embeddingRequestCache.set(cacheKey, resultEmbedding);
    }

    return {
      embedding: resultEmbedding,
      modelUsed: responseData.model || effectiveModel,
      usage: responseData.usage || null,
    };
  } catch (error) {
    if (error instanceof DaitanError) throw error;
    throw new DaitanOperationError(
      `Failed to generate embedding: ${error.message}`,
      { model: effectiveModel },
      error
    );
  }
};

/**
 * @deprecated Use `generateEmbedding({ input: inputsArray })` directly.
 */
export const generateBatchEmbeddings = async (inputsArray, model) => {
  embeddingsServiceLogger.warn(
    '`generateBatchEmbeddings` is deprecated. Use `generateEmbedding({ input: inputsArray, ... })` instead.'
  );
  return generateEmbedding({
    input: inputsArray,
    config: { target: `openai|${model}` },
  });
};

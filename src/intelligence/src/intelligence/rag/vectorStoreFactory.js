// intelligence/src/intelligence/rag/vectorStoreFactory.js
/**
 * @file Factory and management functions for vector store instances.
 * @module @daitanjs/intelligence/rag/vectorStoreFactory
 */
import { getLogger } from '@daitanjs/development';
import { getConfigManager } from '@daitanjs/config';
import {
  DaitanConfigurationError,
  DaitanOperationError,
  DaitanInvalidInputError,
} from '@daitanjs/error';
import { ChromaVectorStoreAdapter } from './chromaVectorStoreAdapter.js';
import { MemoryVectorStoreAdapter } from './memoryVectorStoreAdapter.js';
import { getDefaultCollectionName as getClientDefaultCollection } from './chromaClient.js';

const vectorStoreLogger = getLogger('daitan-rag-vectorstore');

const FALLBACK_DEFAULT_COLLECTION_NAME = 'daitan_rag_default_store';

// --- CORRECTED: Convert constant to a function to defer config access ---
export const DEFAULT_COLLECTION_NAME = () => {
  const configManager = getConfigManager();
  return (
    configManager.get('RAG_DEFAULT_COLLECTION_NAME') ||
    getClientDefaultCollection() ||
    FALLBACK_DEFAULT_COLLECTION_NAME
  );
};

let currentModuleVerbose = false; // Will be set on first getVectorStore call
let vectorStoreAdapterSingleton = null;

export const setRagMemoryVerbose = (isVerbose) => {
  currentModuleVerbose = !!isVerbose;
};

export const getVectorStore = async ({
  persistent,
  collectionName,
  forceRecreateCollection = false,
  embeddingsInstance,
  chromaUrl,
  localVerbose,
} = {}) => {
  const configManager = getConfigManager();
  const usePersistentStore =
    persistent ?? configManager.get('RAG_PERSISTENT_STORE', true);
  const effectiveCollectionName = collectionName || DEFAULT_COLLECTION_NAME();

  currentModuleVerbose =
    localVerbose ?? configManager.get('RAG_MEMORY_VERBOSE', false);

  const requestedStoreType = usePersistentStore ? 'Chroma' : 'Memory';
  let currentStoreType = vectorStoreAdapterSingleton
    ? vectorStoreAdapterSingleton instanceof ChromaVectorStoreAdapter
      ? 'Chroma'
      : 'Memory'
    : null;

  let needsRecreation =
    !vectorStoreAdapterSingleton ||
    forceRecreateCollection ||
    requestedStoreType !== currentStoreType ||
    (vectorStoreAdapterSingleton.collectionName && // Check if collectionName exists before comparing
      vectorStoreAdapterSingleton.collectionName !== effectiveCollectionName);

  if (
    usePersistentStore &&
    vectorStoreAdapterSingleton instanceof ChromaVectorStoreAdapter &&
    chromaUrl &&
    vectorStoreAdapterSingleton.url !== chromaUrl
  ) {
    needsRecreation = true;
  }

  if (!needsRecreation) {
    if (currentModuleVerbose)
      vectorStoreLogger.debug(
        `Returning existing VectorStoreAdapter for "${effectiveCollectionName}".`
      );
    return vectorStoreAdapterSingleton;
  }

  if (currentModuleVerbose)
    vectorStoreLogger.info(
      `Re-initializing VectorStoreAdapter. Type: ${requestedStoreType}, Collection: "${effectiveCollectionName}"`
    );

  if (forceRecreateCollection && usePersistentStore) {
    try {
      const tempAdapter = new ChromaVectorStoreAdapter({
        collectionName: effectiveCollectionName,
        url: chromaUrl,
        embeddings: embeddingsInstance,
      });
      await tempAdapter.deleteCollection();
    } catch (e) {
      vectorStoreLogger.warn(
        `Error during pre-emptive deletion of collection "${effectiveCollectionName}": ${e.message}.`
      );
    }
  }

  try {
    vectorStoreAdapterSingleton = usePersistentStore
      ? new ChromaVectorStoreAdapter({
          collectionName: effectiveCollectionName,
          url: chromaUrl,
          embeddings: embeddingsInstance,
          verbose: currentModuleVerbose,
        })
      : new MemoryVectorStoreAdapter({
          embeddings: embeddingsInstance,
          verbose: currentModuleVerbose,
        });
    return vectorStoreAdapterSingleton;
  } catch (error) {
    vectorStoreAdapterSingleton = null;
    throw new DaitanOperationError(
      `Failed to initialize ${requestedStoreType}VectorStoreAdapter for "${effectiveCollectionName}"`,
      {},
      error
    );
  }
};

export const vectorStoreCollectionExists = async (collectionName) => {
  const configManager = getConfigManager();
  const usePersistentStore = configManager.get('RAG_PERSISTENT_STORE', true);
  if (!usePersistentStore) return true; // In-memory always "exists" once requested

  const effectiveCollectionName = collectionName || DEFAULT_COLLECTION_NAME();
  try {
    const tempAdapter = new ChromaVectorStoreAdapter({
      collectionName: effectiveCollectionName,
    });
    return await tempAdapter.collectionExists();
  } catch (error) {
    vectorStoreLogger.error(
      `Error checking existence for collection "${effectiveCollectionName}": ${error.message}`
    );
    return false;
  }
};

export const embedChunks = async (chunks, options = {}) => {
  const effectiveCollectionName =
    options.collectionName || DEFAULT_COLLECTION_NAME();
  if (!Array.isArray(chunks) || chunks.length === 0) return;
  const adapter = await getVectorStore({
    ...options,
    collectionName: effectiveCollectionName,
  });
  return adapter.addDocuments(chunks, {
    ids: options.ids,
    batchSize: options.batchSize,
  });
};

// intelligence/src/intelligence/rag/chromaClient.js
/**
 * @file Manages the singleton connection and client for ChromaDB.
 * @module @daitanjs/intelligence/rag/chromaClient
 */
import { ChromaClient } from 'chromadb';
import { getLogger } from '@daitanjs/development';
import { getConfigManager } from '@daitanjs/config';
import { DaitanOperationError, DaitanInvalidInputError } from '@daitanjs/error';

const logger = getLogger('daitan-rag-chroma-client');

// --- Configuration Accessors (Restored Exports) ---
export const getChromaHost = () =>
  getConfigManager().get('CHROMA_HOST', 'localhost');
export const getChromaPort = () => getConfigManager().get('CHROMA_PORT', 8000);
export const getChromaTenant = () =>
  getConfigManager().get('CHROMA_TENANT', 'default_tenant');
export const getChromaDatabase = () =>
  getConfigManager().get('CHROMA_DATABASE', 'default_database');
export const getDefaultCollectionName = () =>
  getConfigManager().get(
    'RAG_DEFAULT_COLLECTION_NAME',
    'daitan_rag_default_store'
  );

// --- Constants (Restored Exports) ---
export const CHROMA_PATH = './.vectorstore';
export const COLLECTION = () => getDefaultCollectionName(); // Maintained as function to defer config access

// The singleton client instance.
let chromaClientInstance = null;

// The global fetch patch has been permanently removed as it was the root cause of the bug.

/**
 * Checks if the ChromaDB server is responsive.
 * @public
 */
export const checkChromaConnection = async (timeoutMs = 3000) => {
  const host = getChromaHost();
  const port = getChromaPort();
  const endpointsToTry = [
    `http://${host}:${port}/api/v2/heartbeat`,
    `http://${host}:${port}/api/v1/heartbeat`,
  ];

  for (const url of endpointsToTry) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (response.ok) {
        logger.info(`ChromaDB connection successful on endpoint: ${url}`);
        return true;
      }
    } catch (error) {
      // This is expected if an endpoint doesn't exist.
    }
  }
  logger.error(`ChromaDB connection check failed on all attempted endpoints.`);
  return false;
};

export async function getOrInitializeChromaClient() {
  if (chromaClientInstance) {
    try {
      await chromaClientInstance.heartbeat();
      return chromaClientInstance;
    } catch (error) {
      logger.warn(
        'Existing ChromaDB client connection is stale, re-initializing...'
      );
      chromaClientInstance = null;
    }
  }

  const host = getChromaHost();
  const port = getChromaPort();
  const baseUrl = `http://${host}:${port}`;

  try {
    if (!(await checkChromaConnection())) {
      throw new DaitanOperationError(
        `Could not connect to ChromaDB server at ${baseUrl}.`
      );
    }
    chromaClientInstance = new ChromaClient({ path: baseUrl });
    await chromaClientInstance.heartbeat();
    logger.info(`ChromaDB client initialized and connection confirmed.`);
  } catch (error) {
    chromaClientInstance = null;
    throw new DaitanOperationError(
      `Failed to initialize ChromaDB client: ${error.message}`,
      { host, port },
      error
    );
  }
  return chromaClientInstance;
}

export async function addToChromaDirectly(
  embeddings,
  metadatas,
  ids,
  documents
) {
  if (!Array.isArray(embeddings) || embeddings.length === 0) {
    throw new DaitanInvalidInputError(
      'Embeddings array is required and cannot be empty.'
    );
  }

  try {
    const client = await getOrInitializeChromaClient();
    const collectionName = getDefaultCollectionName();
    const collection = await client.getOrCreateCollection({
      name: collectionName,
      metadata: { 'hnsw:space': 'cosine' },
    });

    const cleanMetadatas = metadatas.map((meta) => {
      if (typeof meta !== 'object' || meta === null) return {};
      return Object.fromEntries(
        Object.entries(meta).filter(
          ([, value]) => value != null && value !== ''
        )
      );
    });

    await collection.add({
      ids,
      embeddings,
      metadatas: cleanMetadatas,
      documents,
    });
    return { success: true, count: embeddings.length, collectionName };
  } catch (error) {
    throw new DaitanOperationError(
      `Failed to add documents to ChromaDB: ${error.message}`,
      { documentCount: embeddings.length },
      error
    );
  }
}

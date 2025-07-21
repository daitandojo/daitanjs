// intelligence/src/intelligence/rag/index.js
/**
 * @file Main entry point for RAG (Retrieval Augmented Generation) functionalities.
 * @module @daitanjs/intelligence/rag
 *
 * @description
 * This module aggregates and exports all public-facing components of the DaitanJS RAG system.
 * It provides a comprehensive toolkit for building applications that can answer questions
 * or generate content based on information retrieved from a knowledge base (vector store).
 */
import { getLogger } from '@daitanjs/development';

const ragIndexLogger = getLogger('daitan-rag-index');
ragIndexLogger.debug('Exporting DaitanJS RAG functionalities...');

// --- High-level RAG Querying & Chat ---
export { askWithRetrieval } from './retrieval.js';
export { createRagChatInstance } from './chat.js';

// --- Document Ingestion Pipeline ---
export { loadAndEmbedFile } from './embed.js';
export {
  loadDocumentsFromFile,
  extractRawTextForMetadata,
} from './documentLoader.js';
export { embedChunks } from './vectorStoreFactory.js';

// --- Vector Store Management ---
export {
  getVectorStore,
  vectorStoreCollectionExists,
  DEFAULT_COLLECTION_NAME,
  setRagMemoryVerbose,
} from './vectorStoreFactory.js';
export { ChromaVectorStoreAdapter } from './chromaVectorStoreAdapter.js';
export { MemoryVectorStoreAdapter } from './memoryVectorStoreAdapter.js';

// --- Conversational Session Memory ---
export {
  resetSessionMemory,
  getSessionMemoryHistory,
  saveSessionContext,
} from './chatMemory.js';

// --- Direct DB Client & Admin ---
export {
  CHROMA_PATH,
  COLLECTION as CHROMA_CLIENT_DEFAULT_COLLECTION,
  getChromaHost,
  getChromaPort,
  getChromaTenant,
  getChromaDatabase,
  getDefaultCollectionName,
  addToChromaDirectly,
  checkChromaConnection,
  getOrInitializeChromaClient,
} from './chromaClient.js';
export { printStoreStats } from './printStats.js';

// --- Type Definitions ---
export * from './interfaces.js';
export * from './vectorStoreAdapterInterface.js';

ragIndexLogger.info('DaitanJS RAG module exports ready.');

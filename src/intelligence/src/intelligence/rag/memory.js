// intelligence/src/intelligence/rag/memory.js
/**
 * @file Main entry point for RAG memory and storage management.
 * @module @daitanjs/intelligence/rag/memory
 *
 * @description
 * This module is a "barrel file" that re-exports the key functionalities from the
 * refactored RAG storage and memory modules. It maintains a consistent public API
 * for the `@daitanjs/intelligence` package, ensuring that consumers who previously
 * imported from here do not break.
 *
 * It aggregates and exports:
 * - Document loading and text extraction utilities.
 * - Vector store factory and interaction functions.
 * - Conversational chat memory management utilities.
 */
export {
  loadDocumentsFromFile,
  extractRawTextForMetadata,
} from './documentLoader.js';

export {
  getVectorStore,
  embedChunks,
  vectorStoreCollectionExists,
  DEFAULT_COLLECTION_NAME,
  setRagMemoryVerbose,
} from './vectorStoreFactory.js';

export {
  sessionMemory,
  resetSessionMemory,
  getSessionMemoryHistory,
} from './chatMemory.js';

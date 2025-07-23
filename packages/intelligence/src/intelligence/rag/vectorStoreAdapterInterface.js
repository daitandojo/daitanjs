// File: src/intelligence/rag/vectorStoreAdapterInterface.js
/**
 * @interface IVectorStoreAdapter
 * Represents the common interface for interacting with different vector store implementations.
 * This interface is conceptual for JavaScript and defined via JSDoc for clarity.
 * Implementations should adhere to these method signatures.
 */

/**
 * Adds documents to the vector store.
 * @async
 * @function IVectorStoreAdapter#addDocuments
 * @param {import('@langchain/core/documents').Document[]} documents - An array of LangChain documents to add.
 * @param {Object} [options] - Optional parameters for adding documents.
 * @param {string[]} [options.ids] - Optional array of IDs for the documents, must match length of documents array.
 * @param {number} [options.batchSize] - Optional preferred batch size for adding documents. Adapter may use its own default.
 * @returns {Promise<void | string[]>} - Promise that resolves when documents are added, optionally returning an array of added document IDs.
 */

/**
 * Performs a similarity search with scores.
 * @async
 * @function IVectorStoreAdapter#similaritySearchWithScore
 * @param {string} query - The query string.
 * @param {number} k - The number of documents to return.
 * @param {Object | Function} [filter] - Optional metadata filter.
 *        If an object, it's typically a key-value filter.
 *        If a function, it's a callback `(doc: Document) => boolean`.
 *        The adapter needs to handle or document how it supports filters.
 * @returns {Promise<Array<[import('@langchain/core/documents').Document, number]>>} - Promise resolving to an array of [document, score] tuples.
 *         Score interpretation (distance vs. similarity) depends on the underlying store.
 */

/**
 * Checks if a specific collection/index exists.
 * @async
 * @function IVectorStoreAdapter#collectionExists
 * @param {string} [collectionName] - The name of the collection. May be optional if adapter is tied to one collection.
 * @returns {Promise<boolean>} - True if the collection exists, false otherwise.
 */

/**
 * Ensures a collection exists, creating it if necessary.
 * @async
 * @function IVectorStoreAdapter#ensureCollection
 * @param {string} [collectionName] - The name of the collection. May be optional.
 * @param {Object} [options] - Options like embedding function details or metadata for collection creation.
 * @returns {Promise<void>}
 */

/**
 * Deletes a collection.
 * @async
 * @function IVectorStoreAdapter#deleteCollection
 * @param {string} [collectionName] - The name of the collection. May be optional.
 * @returns {Promise<void>}
 */

/**
 * Gets the underlying LangChain vector store instance, if direct access is needed
 * and the adapter wraps a LangChain-compatible store.
 * @async
 * @function IVectorStoreAdapter#getLangchainStore
 * @returns {Promise<any | null>} - The LangChain vector store instance (e.g., Chroma, MemoryVectorStore) or null.
 */

// This file is primarily for defining the interface concept.
// Implementations will be in separate adapter files.
// Making it a module so it can be imported for JSDoc @implements tag.
export {};
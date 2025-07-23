// intelligence/src/intelligence/rag/printStats.js
/**
 * @file Utility for printing statistics of a RAG vector store collection.
 * @module @daitanjs/intelligence/rag/printStats
 */
import path from 'path';
import { ChromaClient as DirectChromaClient } from 'chromadb';
import { getLogger } from '@daitanjs/development';
import { getConfigManager } from '@daitanjs/config';
import { DaitanOperationError } from '@daitanjs/error';
import { DEFAULT_COLLECTION_NAME } from './vectorStoreFactory.js';

const statsLogger = getLogger('daitan-rag-stats');

/** @private */
const previewContent = (text, maxLength = 80) => {
  if (typeof text !== 'string') return '<invalid_content>';
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxLength) return cleaned;
  return cleaned.slice(0, maxLength - 3) + '...';
};

/**
 * @typedef {Object} PrintStoreStatsOptions
 * @property {string} [collectionName]
 * @property {number} [sampleLimit=2]
 * @property {string} [chromaHost]
 * @property {number} [chromaPort]
 * @property {boolean} [localVerbose]
 */

/**
 * Prints statistics and sample documents for a specified ChromaDB collection.
 *
 * @param {PrintStoreStatsOptions} [options={}] - Optional parameters.
 * @returns {Promise<void>}
 */
export const printStoreStats = async (options = {}) => {
  const configManager = getConfigManager(); // Lazy-load
  const {
    collectionName: collectionNameInput,
    sampleLimit = 2,
    chromaHost = configManager.get('CHROMA_HOST', 'localhost'),
    chromaPort = configManager.get('CHROMA_PORT', 8000),
    localVerbose,
  } = options;

  const effectiveCollectionName =
    collectionNameInput || DEFAULT_COLLECTION_NAME();
  const logContext = {
    collectionName: effectiveCollectionName,
    host: chromaHost,
    port: chromaPort,
  };

  statsLogger.info(
    `📊 Printing stats for ChromaDB collection: "${effectiveCollectionName}"`
  );

  const chromaUrl = `http://${chromaHost}:${chromaPort}`;
  try {
    const client = new DirectChromaClient({ path: chromaUrl });
    await client.heartbeat();
    const collection = await client.getCollection({
      name: effectiveCollectionName,
    });
    const count = await collection.count();
    statsLogger.info(
      `📦 Collection "${effectiveCollectionName}" contains ${count} document chunks.`
    );

    if (count > 0 && sampleLimit > 0) {
      const results = await collection.peek({
        limit: Math.min(sampleLimit, count),
      });
      const ids = results.ids || [];
      if (ids.length > 0) {
        statsLogger.info(
          `📋 Sample documents from "${effectiveCollectionName}":`
        );
        ids.forEach((id, i) => {
          const metadata = results.metadatas[i] || {};
          const source =
            metadata.source_filename ||
            (metadata.source
              ? path.basename(String(metadata.source))
              : 'unknown');
          statsLogger.info(
            `  #${i + 1} [ID: ${String(id).substring(
              0,
              10
            )}...] Source: ${source} → "${previewContent(
              results.documents[i]
            )}"`
          );
        });
      }
    }
  } catch (err) {
    if (String(err.message).toLowerCase().includes('not found')) {
      statsLogger.error(
        `Collection "${effectiveCollectionName}" does not exist at ${chromaUrl}.`
      );
      return;
    }
    throw new DaitanOperationError(
      `Error getting store stats: ${err.message}`,
      logContext,
      err
    );
  }
};

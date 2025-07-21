// data/src/jsonstore/index.js
/**
 * @file Re-exports public-facing functions for the file-based JSON store.
 * @module @daitanjs/data/jsonstore
 *
 * @description
 * This module acts as the public API for the JSON store functionality. It aggregates
 * and exports the necessary CRUD functions, data extraction utilities, and the query
 * matching helper, providing a single, convenient entry point for consumers.
 */
import { getLogger } from '@daitanjs/development';

const jsonStoreIndexLogger = getLogger('daitan-jsonstore-index');

jsonStoreIndexLogger.debug('Exporting DaitanJS JSON Store functionalities...');

// --- CRUD Operations ---
export {
  jsonStore,
  jsonQuery,
  jsonExist,
  jsonDelete,
  jsonUpdate,
  readJSONsFromFile,
} from './crud.js';

// --- Query Engine ---
export { matchesQuery } from './queryEngine.js';

// --- Data Extraction Utilities ---
/**
 * Extracts a specific field from the last `count` objects in an array of objects.
 *
 * @public
 * @param {object} options
 * @param {object[]} options.objects
 * @param {string} [options.field="topic"]
 * @param {number} [options.count=20]
 * @returns {any[]} An array of the extracted field values.
 */
export function extractField({ objects, field = 'topic', count = 20 }) {
  if (
    !Array.isArray(objects) ||
    typeof field !== 'string' ||
    !field.trim() ||
    typeof count !== 'number' ||
    count < 0
  ) {
    return [];
  }
  return objects
    .slice(-count)
    .map((obj) =>
      obj &&
      typeof obj === 'object' &&
      obj[field] !== undefined &&
      obj[field] !== null
        ? obj[field]
        : undefined
    )
    .filter((value) => value !== undefined);
}

jsonStoreIndexLogger.info('DaitanJS JSON Store module exports ready.');

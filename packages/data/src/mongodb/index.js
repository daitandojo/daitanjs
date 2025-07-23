// data/src/mongodb/index.js
/**
 * @file Main entry point for MongoDB functionalities in @daitanjs/data.
 * @module @daitanjs/data/mongodb
 *
 * @description
 * This module serves as the primary public interface for interacting with MongoDB,
 * offering support for both the native MongoDB driver and the Mongoose ODM.
 *
 * It exports:
 * - **Native MongoDB Driver Utilities**:
 *   - Connection management functions (`connectNativeClient`, `disconnectNativeClient`, `getGlobalNativeClient`).
 *   - A suite of common query functions (`insertOne`, `findOne`, `findMany`, etc.).
 * - **Mongoose ODM Utilities**:
 *   - Connection management functions (`connectToMongoose`, `disconnectFromMongoose`, etc.).
 *   - Helper functions for Mongoose operations (`executeBulkWrite`, `upsertOneWithRetry`, etc.).
 *   - **The `getMongooseInstance` function for accessing the shared Mongoose instance.**
 * - **General MongoDB Utilities**:
 *   - `logDatabaseStructure`, `checkNativeClientHealth`.
 *
 * All functions integrate with DaitanJS logging and error handling.
 */
import { getLogger } from '@daitanjs/development';

const mongoIndexLogger = getLogger('daitan-data-mongodb-index');

mongoIndexLogger.debug('Exporting DaitanJS Data MongoDB functionalities...');

// --- Native MongoDB Driver Exports ---
export {
  connectNativeClient,
  disconnectNativeClient,
  getGlobalNativeClient,
} from './nativeConnection.js';

export {
  insertOne,
  findOne,
  findMany,
  updateOne,
  updateMany,
  deleteOne,
  deleteMany,
  countDocuments,
  aggregate,
  toObjectId,
} from './queries.js';

// --- Mongoose ODM Exports ---
export {
  connectToMongoose,
  disconnectFromMongoose,
  getMongooseDefaultConnection,
  getMongooseDefaultReadyState,
} from './mongooseConnection.js';

export {
  filterNewDocumentsByField,
  executeBulkWrite,
  upsertOneWithRetry,
  findWithModel,
  getMongooseInstance, // Exported for model access from other packages
} from './mongooseUtils.js';

// --- General MongoDB Utilities ---
export { logDatabaseStructure, checkNativeClientHealth } from './utils.js';

mongoIndexLogger.info('DaitanJS Data MongoDB module exports ready.');

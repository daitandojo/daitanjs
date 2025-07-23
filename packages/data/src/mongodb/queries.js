// data/src/mongodb/queries.js
/**
 * @file Native MongoDB driver query functions.
 * @module @daitanjs/data/mongodb/queries
 *
 * @description
 * This module provides a set of asynchronous functions for common MongoDB operations
 * (CRUD, count, aggregate) using the native MongoDB driver. These functions require an active
 * `MongoClient` instance to be passed for execution.
 *
 * Each function performs basic validation of its inputs and wraps MongoDB driver errors
 * in `DaitanDatabaseError` for consistent error handling.
 */
import { getLogger } from '@daitanjs/development';
import { DaitanDatabaseError, DaitanInvalidInputError } from '@daitanjs/error';
import { ObjectId } from 'mongodb';

const nativeQueryLogger = getLogger('daitan-native-mongodb-queries');

/** @private */
const getValidatedCollectionInternal = (
  client,
  collectionName,
  operationName,
  dbName
) => {
  if (!client || typeof client.db !== 'function') {
    throw new DaitanInvalidInputError(
      'Invalid MongoClient instance provided for database operation.'
    );
  }
  if (
    !collectionName ||
    typeof collectionName !== 'string' ||
    !collectionName.trim()
  ) {
    throw new DaitanInvalidInputError(
      'Collection name must be a non-empty string.'
    );
  }
  if (dbName !== undefined && (typeof dbName !== 'string' || !dbName.trim())) {
    throw new DaitanInvalidInputError(
      'If dbName is provided, it must be a non-empty string.'
    );
  }
  const db = client.db(dbName);
  return db.collection(collectionName.trim());
};

/**
 * Inserts a single document into the specified collection.
 * @public
 * @async
 * @param {object} params
 * @param {import('mongodb').MongoClient} params.client
 * @param {string} params.collectionName
 * @param {object} params.document
 * @param {string} [params.dbName]
 * @param {import('mongodb').InsertOneOptions} [params.options]
 * @returns {Promise<string>} The `_id` (as a string) of the inserted document.
 */
export async function insertOne({
  client,
  collectionName,
  document,
  dbName,
  options = {},
}) {
  const operation = 'insertOne';
  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    throw new DaitanInvalidInputError(
      'Document for insertOne must be a non-null object.'
    );
  }
  const collection = getValidatedCollectionInternal(
    client,
    collectionName,
    operation,
    dbName
  );
  nativeQueryLogger.debug(
    `[${operation}] Attempting to insert into "${dbName || 'defaultDB'}.${
      collection.collectionName
    }".`
  );

  try {
    const result = await collection.insertOne(document, options);
    if (!result.insertedId) {
      throw new DaitanDatabaseError(
        'MongoDB insertOne succeeded but returned no insertedId.'
      );
    }
    const insertedIdString = result.insertedId.toString();
    nativeQueryLogger.info(
      `[${operation}] Document inserted into "${collection.collectionName}" with ID: ${insertedIdString}`
    );
    return insertedIdString;
  } catch (error) {
    throw new DaitanDatabaseError(
      `Failed to insert document into "${collection.collectionName}": ${error.message}`,
      { collectionName, operation, mongoErrorCode: error.code },
      error
    );
  }
}

/**
 * Finds a single document in the specified collection.
 * @public
 * @async
 * @param {object} params
 * @param {import('mongodb').MongoClient} params.client
 * @param {string} params.collectionName
 * @param {import('mongodb').Filter<any>} params.query
 * @param {string} [params.dbName]
 * @param {import('mongodb').FindOneOptions} [params.options]
 * @returns {Promise<object | null>} The found document or `null`.
 */
export async function findOne({
  client,
  collectionName,
  query,
  dbName,
  options = {},
}) {
  const operation = 'findOne';
  if (!query || typeof query !== 'object' || Array.isArray(query)) {
    throw new DaitanInvalidInputError(
      'Query for findOne must be a non-null object.'
    );
  }
  const collection = getValidatedCollectionInternal(
    client,
    collectionName,
    operation,
    dbName
  );
  nativeQueryLogger.debug(
    `[${operation}] Attempting to find one document in "${
      dbName || 'defaultDB'
    }.${collection.collectionName}".`
  );

  try {
    const document = await collection.findOne(query, options);
    nativeQueryLogger.info(
      `[${operation}] ${
        document ? 'Document found' : 'No document found'
      } in "${collection.collectionName}".`
    );
    return document;
  } catch (error) {
    throw new DaitanDatabaseError(
      `Failed to find document in "${collection.collectionName}": ${error.message}`,
      { collectionName, operation, query, mongoErrorCode: error.code },
      error
    );
  }
}

/**
 * Finds multiple documents in the specified collection.
 * @public
 * @async
 * @param {object} params
 * @param {import('mongodb').MongoClient} params.client
 * @param {string} params.collectionName
 * @param {import('mongodb').Filter<any>} params.query
 * @param {string} [params.dbName]
 * @param {import('mongodb').FindOptions} [params.options]
 * @returns {Promise<object[]>} An array of found documents.
 */
export async function findMany({
  client,
  collectionName,
  query,
  dbName,
  options = {},
}) {
  const operation = 'findMany';
  if (!query || typeof query !== 'object' || Array.isArray(query)) {
    throw new DaitanInvalidInputError(
      'Query for findMany must be a non-null object.'
    );
  }
  const collection = getValidatedCollectionInternal(
    client,
    collectionName,
    operation,
    dbName
  );
  nativeQueryLogger.debug(
    `[${operation}] Attempting to find documents in "${dbName || 'defaultDB'}.${
      collection.collectionName
    }".`
  );

  try {
    const cursor = collection.find(query, options);
    const documents = await cursor.toArray();
    nativeQueryLogger.info(
      `[${operation}] Found ${documents.length} documents in "${collection.collectionName}".`
    );
    return documents;
  } catch (error) {
    throw new DaitanDatabaseError(
      `Failed to find documents in "${collection.collectionName}": ${error.message}`,
      { collectionName, operation, query, mongoErrorCode: error.code },
      error
    );
  }
}

/**
 * Updates a single document.
 * @public
 * @async
 * @param {object} params
 * @param {import('mongodb').MongoClient} params.client
 * @param {string} params.collectionName
 * @param {import('mongodb').Filter<any>} params.filter
 * @param {import('mongodb').UpdateFilter<any>} params.update
 * @param {string} [params.dbName]
 * @param {import('mongodb').UpdateOptions} [params.options]
 * @returns {Promise<import('mongodb').UpdateResult>}
 */
export async function updateOne({
  client,
  collectionName,
  filter,
  update,
  dbName,
  options = {},
}) {
  const operation = 'updateOne';
  if (!filter || typeof filter !== 'object' || Array.isArray(filter)) {
    throw new DaitanInvalidInputError(
      'Filter for updateOne must be a non-null object.'
    );
  }
  if (
    !update ||
    typeof update !== 'object' ||
    Array.isArray(update) ||
    Object.keys(update).length === 0 ||
    !Object.keys(update).some((key) => key.startsWith('$'))
  ) {
    throw new DaitanInvalidInputError(
      'Update document for updateOne must contain at least one MongoDB update operator.'
    );
  }
  const collection = getValidatedCollectionInternal(
    client,
    collectionName,
    operation,
    dbName
  );
  nativeQueryLogger.debug(
    `[${operation}] Attempting to update one document in "${
      dbName || 'defaultDB'
    }.${collection.collectionName}".`
  );

  try {
    const result = await collection.updateOne(filter, update, options);
    nativeQueryLogger.info(
      `[${operation}] Update in "${collection.collectionName}" completed. Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`
    );
    return result;
  } catch (error) {
    throw new DaitanDatabaseError(
      `Failed to update document in "${collection.collectionName}": ${error.message}`,
      { collectionName, operation, filter, mongoErrorCode: error.code },
      error
    );
  }
}

/**
 * Updates multiple documents.
 * @public
 * @async
 * @param {object} params
 * @param {import('mongodb').MongoClient} params.client
 * @param {string} params.collectionName
 * @param {import('mongodb').Filter<any>} params.filter
 * @param {import('mongodb').UpdateFilter<any>} params.update
 * @param {string} [params.dbName]
 * @param {import('mongodb').UpdateOptions} [params.options]
 * @returns {Promise<import('mongodb').UpdateResult>}
 */
export async function updateMany({
  client,
  collectionName,
  filter,
  update,
  dbName,
  options = {},
}) {
  const operation = 'updateMany';
  if (!filter || typeof filter !== 'object' || Array.isArray(filter)) {
    throw new DaitanInvalidInputError(
      'Filter for updateMany must be a non-null object.'
    );
  }
  if (
    !update ||
    typeof update !== 'object' ||
    Array.isArray(update) ||
    Object.keys(update).length === 0 ||
    !Object.keys(update).some((key) => key.startsWith('$'))
  ) {
    throw new DaitanInvalidInputError(
      'Update document for updateMany must contain at least one MongoDB update operator.'
    );
  }
  const collection = getValidatedCollectionInternal(
    client,
    collectionName,
    operation,
    dbName
  );
  nativeQueryLogger.debug(
    `[${operation}] Attempting to update multiple documents in "${
      dbName || 'defaultDB'
    }.${collection.collectionName}".`
  );

  try {
    const result = await collection.updateMany(filter, update, options);
    nativeQueryLogger.info(
      `[${operation}] updateMany in "${collection.collectionName}" completed. Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`
    );
    return result;
  } catch (error) {
    throw new DaitanDatabaseError(
      `Failed to update multiple documents in "${collection.collectionName}": ${error.message}`,
      { collectionName, operation, filter, mongoErrorCode: error.code },
      error
    );
  }
}

/**
 * Deletes a single document.
 * @public
 * @async
 * @param {object} params
 * @param {import('mongodb').MongoClient} params.client
 * @param {string} params.collectionName
 * @param {import('mongodb').Filter<any>} params.filter
 * @param {string} [params.dbName]
 * @param {import('mongodb').DeleteOptions} [params.options]
 * @returns {Promise<import('mongodb').DeleteResult>}
 */
export async function deleteOne({
  client,
  collectionName,
  filter,
  dbName,
  options = {},
}) {
  const operation = 'deleteOne';
  if (
    !filter ||
    typeof filter !== 'object' ||
    Array.isArray(filter) ||
    Object.keys(filter).length === 0
  ) {
    throw new DaitanInvalidInputError(
      'Filter for deleteOne must be a non-empty object to prevent accidental mass deletion.'
    );
  }
  const collection = getValidatedCollectionInternal(
    client,
    collectionName,
    operation,
    dbName
  );
  nativeQueryLogger.debug(
    `[${operation}] Attempting to delete one document from "${
      dbName || 'defaultDB'
    }.${collection.collectionName}".`
  );

  try {
    const result = await collection.deleteOne(filter, options);
    nativeQueryLogger.info(
      `[${operation}] Delete in "${collection.collectionName}" completed. Deleted count: ${result.deletedCount}`
    );
    return result;
  } catch (error) {
    throw new DaitanDatabaseError(
      `Failed to delete document from "${collection.collectionName}": ${error.message}`,
      { collectionName, operation, filter, mongoErrorCode: error.code },
      error
    );
  }
}

/**
 * Deletes multiple documents.
 * @public
 * @async
 * @param {object} params
 * @param {import('mongodb').MongoClient} params.client
 * @param {string} params.collectionName
 * @param {import('mongodb').Filter<any>} params.filter
 * @param {string} [params.dbName]
 * @param {import('mongodb').DeleteOptions} [params.options]
 * @returns {Promise<import('mongodb').DeleteResult>}
 */
export async function deleteMany({
  client,
  collectionName,
  filter,
  dbName,
  options = {},
}) {
  const operation = 'deleteMany';
  if (!filter || typeof filter !== 'object' || Array.isArray(filter)) {
    throw new DaitanInvalidInputError(
      'Filter for deleteMany must be a non-null object.'
    );
  }
  if (Object.keys(filter).length === 0) {
    nativeQueryLogger.warn(
      `[${operation}] WARNING: deleteMany called with an empty filter on "${collectionName}".`
    );
  }
  const collection = getValidatedCollectionInternal(
    client,
    collectionName,
    operation,
    dbName
  );
  nativeQueryLogger.debug(
    `[${operation}] Attempting to delete multiple documents from "${
      dbName || 'defaultDB'
    }.${collection.collectionName}".`
  );

  try {
    const result = await collection.deleteMany(filter, options);
    nativeQueryLogger.info(
      `[${operation}] deleteMany in "${collection.collectionName}" completed. Deleted count: ${result.deletedCount}`
    );
    return result;
  } catch (error) {
    throw new DaitanDatabaseError(
      `Failed to delete multiple documents from "${collection.collectionName}": ${error.message}`,
      { collectionName, operation, filter, mongoErrorCode: error.code },
      error
    );
  }
}

/**
 * Counts the number of documents matching a query.
 * @public
 * @async
 * @param {object} params
 * @param {import('mongodb').MongoClient} params.client
 * @param {string} params.collectionName
 * @param {import('mongodb').Filter<any>} params.query
 * @param {string} [params.dbName]
 * @param {import('mongodb').CountDocumentsOptions} [params.options]
 * @returns {Promise<number>}
 */
export async function countDocuments({
  client,
  collectionName,
  query,
  dbName,
  options = {},
}) {
  const operation = 'countDocuments';
  if (!query || typeof query !== 'object' || Array.isArray(query)) {
    throw new DaitanInvalidInputError(
      'Query for countDocuments must be a non-null object.'
    );
  }
  const collection = getValidatedCollectionInternal(
    client,
    collectionName,
    operation,
    dbName
  );
  nativeQueryLogger.debug(
    `[${operation}] Attempting to count documents in "${
      dbName || 'defaultDB'
    }.${collection.collectionName}".`
  );

  try {
    const count = await collection.countDocuments(query, options);
    nativeQueryLogger.info(
      `[${operation}] Counted ${count} documents in "${collection.collectionName}".`
    );
    return count;
  } catch (error) {
    throw new DaitanDatabaseError(
      `Failed to count documents in "${collection.collectionName}": ${error.message}`,
      { collectionName, operation, query, mongoErrorCode: error.code },
      error
    );
  }
}

/**
 * Performs an aggregation operation.
 * @public
 * @async
 * @param {object} params
 * @param {import('mongodb').MongoClient} params.client
 * @param {string} params.collectionName
 * @param {object[]} params.pipeline
 * @param {string} [params.dbName]
 * @param {import('mongodb').AggregateOptions} [params.options]
 * @returns {Promise<object[]>}
 */
export async function aggregate({
  client,
  collectionName,
  pipeline,
  dbName,
  options = {},
}) {
  const operation = 'aggregate';
  if (
    !Array.isArray(pipeline) ||
    pipeline.length === 0 ||
    !pipeline.every((stage) => typeof stage === 'object' && stage !== null)
  ) {
    throw new DaitanInvalidInputError(
      'Aggregation pipeline must be a non-empty array of stage objects.'
    );
  }
  const collection = getValidatedCollectionInternal(
    client,
    collectionName,
    operation,
    dbName
  );
  nativeQueryLogger.debug(
    `[${operation}] Attempting aggregation on "${dbName || 'defaultDB'}.${
      collection.collectionName
    }".`
  );

  try {
    const cursor = collection.aggregate(pipeline, options);
    const results = await cursor.toArray();
    nativeQueryLogger.info(
      `[${operation}] Aggregation on "${collection.collectionName}" completed, returned ${results.length} documents.`
    );
    return results;
  } catch (error) {
    throw new DaitanDatabaseError(
      `Aggregation failed on "${collection.collectionName}": ${error.message}`,
      {
        collectionName,
        operation,
        pipelineLength: pipeline.length,
        mongoErrorCode: error.code,
      },
      error
    );
  }
}

/**
 * Helper to convert a string ID to a MongoDB ObjectId.
 * @public
 * @param {string} idString - The string representation of the ObjectId.
 * @returns {ObjectId} The MongoDB ObjectId.
 * @throws {DaitanInvalidInputError} If `idString` is not a valid ObjectId hex string.
 */
export function toObjectId(idString) {
  if (!ObjectId.isValid(idString)) {
    throw new DaitanInvalidInputError(
      `"${idString}" is not a valid ObjectId string.`
    );
  }
  return new ObjectId(idString);
}

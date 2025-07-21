// data/src/mongodb/utils.js
/**
 * @file General MongoDB utility functions, primarily using the native MongoDB driver.
 * @module @daitanjs/data/mongodb/utils
 *
 * @description
 * This module provides utility functions for MongoDB interactions that are generally
 * useful, such as logging database structure or checking client health. These functions
 * typically operate using an active `MongoClient` instance.
 */
import { getLogger } from '@daitanjs/development';
import { DaitanDatabaseError, DaitanInvalidInputError } from '@daitanjs/error';

const mongoUtilsLogger = getLogger('daitan-mongodb-utils');

/**
 * Logs the structure of a MongoDB database, including its collections, document counts,
 * and optionally, sample documents and index information for each collection.
 * This function uses the native MongoDB driver client.
 *
 * @public
 * @async
 * @param {import('mongodb').MongoClient} client - The connected MongoClient instance.
 * @param {object} [options={}] - Optional parameters for logging.
 * @param {string} [options.dbName] - Specific database name to inspect. If not provided,
 *                                    uses the client's default database (from connection string or `client.db()`).
 * @param {number} [options.sampleLimit=2] - Number of sample documents to fetch and log per collection. Set to 0 to disable samples.
 * @param {boolean} [options.includeIndexes=false] - If true, logs index information for each collection.
 * @param {boolean} [options.verbose=false] - Enable more detailed logging output from this function itself.
 * @returns {Promise<void>} Resolves when logging is complete.
 * @throws {DaitanInvalidInputError} If `client` is invalid.
 * @throws {DaitanDatabaseError} If database operations (listing collections, counting, fetching samples/indexes) fail.
 */
export async function logDatabaseStructure(client, options = {}) {
  const {
    dbName,
    sampleLimit = 2,
    includeIndexes = false,
    verbose = false,
  } = options;
  const callId = `logStruct-${dbName || 'defaultDB'}-${Date.now().toString(
    36
  )}`;
  const logger = mongoUtilsLogger;

  logger.info(`[${callId}] Starting database structure logging.`, {
    dbName: dbName || 'Default DB from client',
    sampleLimit,
    includeIndexes,
    verboseSelf: verbose,
  });

  if (
    !client ||
    typeof client.db !== 'function' ||
    !(client instanceof Object.getPrototypeOf(client).constructor)
  ) {
    const errMsg =
      'Invalid MongoClient instance provided to logDatabaseStructure.';
    logger.error(`[${callId}] ${errMsg}`, { clientType: typeof client });
    throw new DaitanInvalidInputError(errMsg);
  }
  if (dbName !== undefined && (typeof dbName !== 'string' || !dbName.trim())) {
    const errMsg =
      'If dbName is provided for logDatabaseStructure, it must be a non-empty string.';
    logger.error(`[${callId}] ${errMsg}`, { dbName });
    throw new DaitanInvalidInputError(errMsg);
  }

  try {
    const db = client.db(dbName);
    const actualDbName = db.databaseName;
    logger.info(`[${callId}] Inspecting database: "${actualDbName}"`);

    const collectionsList = await db.listCollections().toArray();

    if (collectionsList.length === 0) {
      logger.info(
        `[${callId}] No collections found in database "${actualDbName}".`
      );
      return;
    }

    logger.info(
      `[${callId}] Database Structure for "${actualDbName}": (${collectionsList.length} collections)`
    );
    for (const collectionInfo of collectionsList) {
      const collectionName = collectionInfo.name;
      if (collectionName.startsWith('system.')) {
        if (verbose)
          logger.debug(
            `[${callId}] Skipping system collection: ${collectionName}`
          );
        continue;
      }
      const collection = db.collection(collectionName);
      let count = -1;
      let countError = null;

      try {
        count = await collection.countDocuments();
      } catch (err) {
        countError = err.message;
        logger.warn(
          `[${callId}] Error counting documents in collection "${collectionName}": ${err.message}`
        );
      }

      logger.info(
        `  ↳ Collection: "${collectionName}" (Documents: ${
          count >= 0 ? count : `Error counting (${countError || 'Unknown'})`
        })`
      );

      if (includeIndexes) {
        try {
          const indexes = await collection.listIndexes().toArray();
          if (indexes.length > 0) {
            logger.info(`    Indexes for "${collectionName}":`);
            indexes.forEach((index) => {
              logger.info(
                `      - Name: ${index.name}, Keys: ${JSON.stringify(
                  index.key
                )}, Unique: ${!!index.unique}, Sparse: ${!!index.sparse}`
              );
            });
          } else {
            logger.info(
              `    No custom indexes found for "${collectionName}" (besides default _id).`
            );
          }
        } catch (indexErr) {
          logger.warn(
            `[${callId}] Error fetching indexes for collection "${collectionName}": ${indexErr.message}`
          );
        }
      }

      if (count > 0 && sampleLimit > 0) {
        try {
          const sampleDocs = await collection
            .find()
            .limit(sampleLimit)
            .toArray();
          if (sampleDocs.length > 0) {
            logger.info(
              `    Sample document(s) from "${collectionName}" (limit ${sampleLimit}):`
            );
            sampleDocs.forEach((doc, idx) => {
              const { _id, ...docWithoutId } = doc;
              const previewFields = Object.keys(docWithoutId).slice(0, 3);
              const preview = {
                _id: _id?.toString(),
                ...previewFields.reduce((acc, key) => {
                  acc[key] = docWithoutId[key];
                  return acc;
                }, {}),
              };
              if (Object.keys(docWithoutId).length > 3)
                preview['...'] = '(more fields)';

              logger.info(
                `      Sample ${idx + 1}: ${JSON.stringify(preview)}`
              );
              if (verbose && idx === 0) {
                logger.debug(
                  `        Full first sample for "${collectionName}":`,
                  doc
                );
              }
            });
          }
        } catch (sampleErr) {
          logger.warn(
            `[${callId}] Error fetching sample documents from "${collectionName}": ${sampleErr.message}`
          );
        }
      } else if (count === 0 && sampleLimit > 0) {
        logger.info(
          `    Collection "${collectionName}" is empty, no samples to show.`
        );
      }
    }
    logger.info(
      `[${callId}] Database structure logging complete for "${actualDbName}".`
    );
  } catch (error) {
    const dbContextName = dbName || client.options?.dbName || 'Default DB';
    logger.error(
      `[${callId}] Error logging database structure for "${dbContextName}": ${error.message}`,
      { errorName: error.name }
    );
    throw new DaitanDatabaseError(
      `Failed to log database structure for "${dbContextName}": ${error.message}`,
      {
        dbName: dbContextName,
        operation: 'logStructure',
        nodeErrorCode: error.code,
      },
      error
    );
  }
}

/**
 * Checks the health of the MongoDB native client connection by performing a ping command.
 *
 * @public
 * @async
 * @param {import('mongodb').MongoClient} client - The MongoClient instance to check.
 * @returns {Promise<boolean>} True if the ping command is successful, indicating a healthy connection. False otherwise.
 * @throws {DaitanInvalidInputError} If `client` is invalid.
 */
export async function checkNativeClientHealth(client) {
  const logger = mongoUtilsLogger;
  const callId = `nativeHealthCheck-${Date.now().toString(36)}`;

  if (
    !client ||
    typeof client.db !== 'function' ||
    !(client instanceof Object.getPrototypeOf(client).constructor)
  ) {
    logger.warn(
      `[${callId}] checkNativeClientHealth: Invalid MongoClient instance provided. Cannot perform health check.`
    );
    throw new DaitanInvalidInputError(
      'Invalid MongoClient instance provided for health check.'
    );
  }

  if (!client.topology || !client.topology.isConnected()) {
    logger.warn(
      `[${callId}] checkNativeClientHealth: Client topology reports not connected. Ping likely to fail.`
    );
  }

  try {
    const pingResult = await client.db().command({ ping: 1 });
    if (pingResult && pingResult.ok === 1) {
      logger.info(
        `[${callId}] Native MongoClient health check (ping) successful.`
      );
      return true;
    } else {
      logger.warn(
        `[${callId}] Native MongoClient health check (ping) completed but response was not 'ok:1'.`,
        { pingResult }
      );
      return false;
    }
  } catch (error) {
    logger.error(`[${callId}] Native MongoClient health check (ping) FAILED.`, {
      errorMessage: error.message,
      errorCode: error.code,
      errorName: error.name,
    });
    return false;
  }
}

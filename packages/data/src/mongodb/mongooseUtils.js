// data/src/mongodb/mongooseUtils.js
/**
 * @file Mongoose-specific utility functions.
 * @module @daitanjs/data/mongodb/mongooseUtils
 *
 * @description
 * This module provides helper functions designed to simplify common or complex
 * operations when using Mongoose. It includes utilities for idempotent document
 * creation/updates (upserts), filtering new documents against existing ones,
 * and performing bulk write operations.
 *
 * It also exports a getter for the shared, global Mongoose instance that is
 * managed by the `@daitanjs/data` package.
 */
import mongoose from 'mongoose';
import { getLogger } from '@daitanjs/development';
import {
  retryWithBackoff,
  isRetryableError,
  isObject,
} from '@daitanjs/utilities';
import { DaitanInvalidInputError, DaitanDatabaseError } from '@daitanjs/error';

const mongooseUtilsLogger = getLogger('daitan-mongoose-utils');

/**
 * Returns the singleton Mongoose instance used by the DaitanJS data library.
 * This ensures that all modules are interacting with the same Mongoose object,
 * which is crucial for connection and model management.
 * @public
 * @returns {mongoose.Mongoose} The global Mongoose instance.
 */
export const getMongooseInstance = () => {
  return mongoose;
};

/**
 * Filters an array of new document objects against an existing collection
 * to find which ones do not yet exist based on a unique field.
 * @public
 * @async
 * @param {import('mongoose').Model<any>} Model - The Mongoose model to query.
 * @param {object[]} documents - The array of new document objects to check.
 * @param {string} uniqueField - The field to check for uniqueness (e.g., 'email', 'externalId').
 * @param {object} [options={}] - Additional options.
 * @param {import('winston').Logger} [options.loggerInstance] - Optional logger.
 * @returns {Promise<object[]>} An array containing only the documents that are new.
 */
export const filterNewDocumentsByField = async (
  Model,
  documents,
  uniqueField,
  options = {}
) => {
  const logger = options.loggerInstance || mongooseUtilsLogger;

  if (!Model || !Model.modelName) {
    throw new DaitanInvalidInputError(
      'A valid Mongoose model must be provided.'
    );
  }
  if (!Array.isArray(documents)) {
    throw new DaitanInvalidInputError(
      'Documents to filter must be provided as an array.'
    );
  }
  if (documents.length === 0) return [];
  if (typeof uniqueField !== 'string' || !uniqueField.trim()) {
    throw new DaitanInvalidInputError(
      'uniqueField must be a non-empty string.'
    );
  }

  const uniqueValues = documents
    .map((doc) => doc?.[uniqueField])
    .filter((value) => value !== undefined && value !== null);

  if (uniqueValues.length === 0) {
    return documents;
  }

  try {
    const existingDocs = await Model.find({
      [uniqueField]: { $in: uniqueValues },
    })
      .select({ [uniqueField]: 1 })
      .lean()
      .exec();

    const existingValuesSet = new Set(
      existingDocs.map((doc) => doc[uniqueField])
    );
    return documents.filter((doc) => !existingValuesSet.has(doc[uniqueField]));
  } catch (error) {
    throw new DaitanDatabaseError(
      `Database error while filtering new documents: ${error.message}`,
      { modelName: Model.modelName, uniqueField },
      error
    );
  }
};

/**
 * Executes a bulk write operation on a Mongoose model.
 * @public
 * @async
 * @param {import('mongoose').Model<any>} Model
 * @param {Array<object>} operations - An array of Mongoose bulk write operations.
 * @param {object} [options={}] - Mongoose `bulkWrite` options (e.g., `{ ordered: false }`).
 * @param {import('winston').Logger} [loggerInstance]
 * @returns {Promise<import('mongoose').mongo.BulkWriteResult | null>}
 */
export const executeBulkWrite = async (
  Model,
  operations,
  options = {},
  loggerInstance
) => {
  const logger = loggerInstance || mongooseUtilsLogger;

  if (!Model || !Model.modelName) {
    throw new DaitanInvalidInputError(
      'A valid Mongoose model must be provided for bulk write.'
    );
  }
  if (!Array.isArray(operations) || operations.length === 0) {
    return null;
  }

  try {
    const result = await Model.bulkWrite(operations, options);
    if (result?.hasWriteErrors()) {
      logger.error(
        'Bulk write operation encountered errors.',
        result.getWriteErrors()
      );
    }
    return result;
  } catch (error) {
    throw new DaitanDatabaseError(
      `Bulk write operation failed: ${error.message}`,
      { modelName: Model.modelName },
      error
    );
  }
};

/**
 * @typedef {Object} UpsertResult
 * @property {object} document - The final document (either updated or inserted).
 * @property {'updated' | 'inserted' | 'matched_no_update'} status - The result of the operation.
 * @property {boolean} isNew - True if the document was newly inserted.
 */

/**
 * Performs a robust upsert (update or insert) operation with retry logic.
 * @public
 * @async
 * @param {import('mongoose').Model<any>} Model
 * @param {object} filter - The query filter to find the document.
 * @param {object} updateData - The data to insert or use for the `$set` update.
 * @param {object} [options={}]
 * @returns {Promise<UpsertResult>}
 */
export const upsertOneWithRetry = async (
  Model,
  filter,
  updateData,
  options = {}
) => {
  const {
    maxRetries = 2,
    retryDelayBase = 500,
    loggerInstance = mongooseUtilsLogger,
    returnFullDoc = true,
  } = options;

  const operation = async () => {
    // Check if a document matching the filter already exists.
    const docToUpdate = await Model.findOne(filter).lean().exec();

    if (docToUpdate) {
      // Document exists, check if an update is needed.
      const isModified = Object.keys(updateData).some(
        (key) =>
          JSON.stringify(docToUpdate[key]) !== JSON.stringify(updateData[key])
      );

      if (isModified) {
        // Perform the update.
        const updatedDoc = await Model.findByIdAndUpdate(
          docToUpdate._id,
          { $set: updateData },
          { new: true, runValidators: true, lean: true }
        ).exec();
        return {
          document: returnFullDoc ? updatedDoc : { _id: updatedDoc._id },
          status: 'updated',
          isNew: false,
        };
      } else {
        // Document exists but no changes are needed.
        return {
          document: returnFullDoc ? docToUpdate : { _id: docToUpdate._id },
          status: 'matched_no_update',
          isNew: false,
        };
      }
    } else {
      // Document does not exist, create it.
      const newDoc = await Model.create(updateData);
      return {
        document: returnFullDoc ? newDoc.toObject() : { _id: newDoc._id },
        status: 'inserted',
        isNew: true,
      };
    }
  };

  try {
    return await retryWithBackoff(operation, maxRetries, {
      initialDelayMs: retryDelayBase,
      loggerInstance,
      operationName: `UpsertOne on ${Model.modelName}`,
      isRetryable: (e) =>
        e instanceof DaitanDatabaseError && isRetryableError(e),
    });
  } catch (error) {
    loggerInstance.error(
      `Upsert operation failed permanently for model ${Model.modelName} after retries.`,
      { filter, error: error.message }
    );
    throw error;
  }
};

/**
 * A generalized find utility for Mongoose models with enhanced options.
 * @public
 * @async
 * @param {import('mongoose').Model<any>} Model
 * @param {object} filter - The Mongoose query filter.
 * @param {object} [options={}] - Options for the find operation.
 * @returns {Promise<object[]>} An array of found documents.
 */
export const findWithModel = async (Model, filter, options = {}) => {
  const {
    sort,
    limit,
    skip,
    select,
    populate,
    lean = true,
    loggerInstance = mongooseUtilsLogger,
  } = options;

  if (!Model || !Model.modelName) {
    throw new DaitanInvalidInputError(
      'A valid Mongoose model must be provided to findWithModel.'
    );
  }

  try {
    let query = Model.find(filter);
    if (sort) query = query.sort(sort);
    if (skip) query = query.skip(skip);
    if (limit) query = query.limit(limit);
    if (select) query = query.select(select);
    if (populate) query = query.populate(populate);
    if (lean) query = query.lean();

    return await query.exec();
  } catch (error) {
    loggerInstance.error(
      `Error finding documents in model '${Model.modelName}': ${error.message}`
    );
    throw new DaitanDatabaseError(
      `Find operation failed for model ${Model.modelName}`,
      { filter },
      error
    );
  }
};

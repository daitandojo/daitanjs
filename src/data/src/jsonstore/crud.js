// data/src/jsonstore/crud.js
/**
 * @file Provides CRUD (Create, Read, Update, Delete) operations for the file-based JSON store.
 * @module @daitanjs/data/jsonstore/crud
 *
 * @description
 * This module contains the primary public functions for interacting with a line-delimited
 * JSON file store. It handles file I/O operations and uses the query engine for filtering.
 */
import path from 'path';
import fs from 'fs';
import fsPromises from 'fs/promises';
import os from 'os';
import { getLogger } from '@daitanjs/development';
import { getConfigManager } from '@daitanjs/config';
import {
  DaitanFileOperationError,
  DaitanConfigurationError,
  DaitanInvalidInputError,
  DaitanOperationError,
} from '@daitanjs/error';
import {
  validateAgainstSimpleSchema,
  formatSimpleSchemaErrors,
} from './jsonSchemaValidator.js';
import { matchesQuery } from './queryEngine.js';

const jsonStoreCrudLogger = getLogger('daitan-jsonstore-crud');

const DEFAULT_JSONSTORE_FILENAME = 'jsonStore.ldjson';
let DEFAULT_JSONSTORE_FILE_PATH_CACHE = null;

/** @private */
function getDefaultJsonStoreFilePathInternal() {
  if (DEFAULT_JSONSTORE_FILE_PATH_CACHE) {
    return DEFAULT_JSONSTORE_FILE_PATH_CACHE;
  }
  const configManager = getConfigManager(); // Lazy-load
  let determinedPath;
  const configuredPath = configManager.get('JSON_STORE_DEFAULT_PATH');
  if (configuredPath) {
    determinedPath = path.resolve(String(configuredPath).trim());
  } else {
    let defaultBaseDir;
    try {
      defaultBaseDir = path.join(os.tmpdir(), 'daitanjs_data', 'jsonstore');
    } catch (tmpDirError) {
      jsonStoreCrudLogger.warn(
        `Could not resolve os.tmpdir(), falling back to CWD for jsonstore base. Error: ${tmpDirError.message}`
      );
      defaultBaseDir = path.resolve(
        process.cwd(),
        '.daitanjs_data',
        'jsonstore'
      );
    }
    if (!fs.existsSync(defaultBaseDir)) {
      fs.mkdirSync(defaultBaseDir, { recursive: true });
    }
    determinedPath = path.join(defaultBaseDir, DEFAULT_JSONSTORE_FILENAME);
  }
  jsonStoreCrudLogger.info(`JSON Store path resolved to: "${determinedPath}"`);
  DEFAULT_JSONSTORE_FILE_PATH_CACHE = determinedPath;
  return determinedPath;
}

/** @private */
function logJsonStoreOp(level, message, filePathContext, meta, loggerInstance) {
  const configManager = getConfigManager(); // Lazy-load
  const isVerbose =
    configManager.get('JSON_STORE_VERBOSE', false) ||
    configManager.get('EXTENSIVE_LOGGING', false);
  if (isVerbose || level === 'error' || level === 'warn') {
    (loggerInstance || jsonStoreCrudLogger)[level](
      `[File: ${path.basename(filePathContext || 'unknown')}] ${message}`,
      meta
    );
  }
}

/** @private */
async function ensureFileExistsInternal(filePath, loggerInstance) {
  const dir = path.dirname(filePath);
  try {
    await fsPromises.mkdir(dir, { recursive: true });
    await fsPromises.access(filePath, fs.constants.F_OK);
  } catch (error) {
    if (error.code === 'ENOENT') {
      await fsPromises.writeFile(filePath, '', 'utf-8');
      logJsonStoreOp(
        'debug',
        `Created new empty jsonstore file: "${filePath}"`,
        filePath,
        {},
        loggerInstance
      );
    } else {
      throw new DaitanFileOperationError(
        `Failed to ensure jsonstore file exists at "${filePath}": ${error.message}`,
        { path: filePath, operation: 'ensureFile' },
        error
      );
    }
  }
}

/**
 * Reads JSON objects from a line-delimited JSON file.
 * @public
 * @async
 * @param {object} [params={}]
 * @param {string} [params.filePath] - Optional path to the JSON store file.
 * @param {import('winston').Logger} [params.loggerInstance] - Optional logger.
 * @returns {Promise<object[]>} An array of parsed JSON objects.
 */
export async function readJSONsFromFile({
  filePath: customFilePath,
  loggerInstance,
} = {}) {
  const effectiveLogger = loggerInstance || jsonStoreCrudLogger;
  const filePath = customFilePath || getDefaultJsonStoreFilePathInternal();
  await ensureFileExistsInternal(filePath, effectiveLogger);

  let fileContent;
  try {
    fileContent = await fsPromises.readFile(filePath, 'utf-8');
  } catch (error) {
    throw new DaitanFileOperationError(
      `Failed to read JSONs from file "${filePath}": ${error.message}`,
      { path: filePath, operation: 'read_json_lines' },
      error
    );
  }

  if (!fileContent.trim()) return [];

  const lines = fileContent.trim().split('\n');
  const objects = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line) {
      try {
        objects.push(JSON.parse(line));
      } catch (parseError) {
        logJsonStoreOp(
          'warn',
          `Skipping invalid JSON at line ${i + 1} in "${filePath}".`,
          filePath,
          {
            error: parseError.message,
            lineContentPreview: line.substring(0, 100),
          },
          effectiveLogger
        );
      }
    }
  }
  return objects;
}

/**
 * Stores a JSON object in a line-delimited JSON file.
 * @public
 * @async
 * @param {object} params
 * @param {object} params.object - The JSON object to store.
 * @param {string} [params.filePath] - Optional path to the store file.
 * @param {object} [params.schema] - Optional schema for validation.
 * @param {import('winston').Logger} [params.loggerInstance] - Optional logger.
 * @returns {Promise<void>}
 */
export async function jsonStore({
  object,
  filePath: customFilePath,
  schema,
  loggerInstance,
}) {
  const effectiveLogger = loggerInstance || jsonStoreCrudLogger;
  const filePath = customFilePath || getDefaultJsonStoreFilePathInternal();
  await ensureFileExistsInternal(filePath, effectiveLogger);

  if (typeof object !== 'object' || object === null || Array.isArray(object)) {
    throw new DaitanInvalidInputError(
      'Data to store must be a plain JSON object.'
    );
  }

  if (schema) {
    const validationErrors = validateAgainstSimpleSchema(object, schema);
    if (validationErrors.length > 0) {
      throw new DaitanInvalidInputError(
        `Schema validation failed: ${formatSimpleSchemaErrors(
          validationErrors
        )}`
      );
    }
  }

  try {
    const jsonString = JSON.stringify(object);
    await fsPromises.appendFile(filePath, jsonString + '\n', 'utf-8');
  } catch (error) {
    if (error.message.includes('circular structure')) {
      throw new DaitanInvalidInputError(
        `Object contains circular references: ${error.message}`
      );
    }
    throw new DaitanFileOperationError(
      `Unable to store JSON object in "${filePath}": ${error.message}`
    );
  }
}

/**
 * Queries a line-delimited JSON file.
 * @public
 * @async
 * @param {object} params
 * @param {object | Function} params.query - The query object or filter function.
 * @param {string} [params.filePath] - Optional path to the store file.
 * @param {import('winston').Logger} [params.loggerInstance] - Optional logger.
 * @returns {Promise<object[]>} An array of matching objects.
 */
export async function jsonQuery({
  query,
  filePath: customFilePath,
  loggerInstance,
}) {
  const effectiveLogger = loggerInstance || jsonStoreCrudLogger;
  const filePath = customFilePath || getDefaultJsonStoreFilePathInternal();
  const dataObjects = await readJSONsFromFile({
    filePath,
    loggerInstance: effectiveLogger,
  });

  if (typeof query === 'function') {
    try {
      return dataObjects.filter((obj) => query(obj));
    } catch (e) {
      throw new DaitanOperationError(
        `Filter function threw an error: ${e.message}`
      );
    }
  } else if (typeof query === 'object' && query !== null) {
    return Object.keys(query).length === 0
      ? dataObjects
      : dataObjects.filter((obj) => matchesQuery(obj, query, effectiveLogger));
  }
  return dataObjects;
}

/**
 * Checks if at least one object matching the query exists.
 * @public
 * @async
 * @param {object} params
 * @param {object | Function} params.query
 * @param {string} [params.filePath]
 * @param {import('winston').Logger} [params.loggerInstance]
 * @returns {Promise<boolean>}
 */
export async function jsonExist({
  query,
  filePath: customFilePath,
  loggerInstance,
}) {
  const results = await jsonQuery({
    query,
    filePath: customFilePath,
    loggerInstance,
  });
  return results.length > 0;
}

/**
 * Deletes objects matching a given query.
 * @public
 * @async
 * @param {object} params
 * @param {object | Function} params.query
 * @param {string} [params.filePath]
 * @param {import('winston').Logger} [params.loggerInstance]
 * @returns {Promise<{success: boolean, deletedCount: number}>}
 */
export async function jsonDelete({
  query,
  filePath: customFilePath,
  loggerInstance,
}) {
  const effectiveLogger = loggerInstance || jsonStoreCrudLogger;
  const filePath = customFilePath || getDefaultJsonStoreFilePathInternal();
  await ensureFileExistsInternal(filePath, effectiveLogger);

  const allObjects = await readJSONsFromFile({
    filePath,
    loggerInstance: effectiveLogger,
  });
  let objectsToKeep = [];
  let deletedCount = 0;

  if (typeof query === 'function') {
    try {
      objectsToKeep = allObjects.filter((obj) => {
        const shouldDelete = query(obj);
        if (shouldDelete) deletedCount++;
        return !shouldDelete;
      });
    } catch (e) {
      throw new DaitanOperationError(
        `Filter function threw an error: ${e.message}`
      );
    }
  } else if (typeof query === 'object' && query !== null) {
    if (Object.keys(query).length === 0) {
      deletedCount = allObjects.length;
    } else {
      objectsToKeep = allObjects.filter((obj) => {
        const shouldDelete = matchesQuery(obj, query, effectiveLogger);
        if (shouldDelete) deletedCount++;
        return !shouldDelete;
      });
    }
  } else {
    return { success: true, deletedCount: 0 };
  }

  if (
    deletedCount > 0 ||
    (allObjects.length > 0 && objectsToKeep.length === 0)
  ) {
    try {
      const contentToWrite =
        objectsToKeep.length > 0
          ? objectsToKeep.map((obj) => JSON.stringify(obj)).join('\n') + '\n'
          : '';
      await fsPromises.writeFile(filePath, contentToWrite, 'utf-8');
      return { success: true, deletedCount };
    } catch (error) {
      throw new DaitanFileOperationError(
        `Failed to write data after delete: ${error.message}`
      );
    }
  }
  return { success: true, deletedCount: 0 };
}

/**
 * Updates objects matching a given query.
 * @public
 * @async
 * @param {object} params
 * @param {object | Function} params.query
 * @param {object | Function} params.updates - Object to merge or function to apply.
 * @param {string} [params.filePath]
 * @param {object} [params.schema]
 * @param {import('winston').Logger} [params.loggerInstance]
 * @returns {Promise<{success: boolean, updatedCount: number}>}
 */
export async function jsonUpdate({
  query,
  updates,
  filePath: customFilePath,
  schema,
  loggerInstance,
}) {
  const effectiveLogger = loggerInstance || jsonStoreCrudLogger;
  const filePath = customFilePath || getDefaultJsonStoreFilePathInternal();
  const isUpdateObject =
    typeof updates === 'object' && updates !== null && !Array.isArray(updates);
  const isUpdateFunction = typeof updates === 'function';

  if (!isUpdateObject && !isUpdateFunction) {
    throw new DaitanInvalidInputError(
      '`updates` must be an object or a function.'
    );
  }
  await ensureFileExistsInternal(filePath, effectiveLogger);
  const allObjects = await readJSONsFromFile({
    filePath,
    loggerInstance: effectiveLogger,
  });
  let updatedCount = 0;
  const updatedObjects = [];

  for (const originalObj of allObjects) {
    const shouldUpdate =
      typeof query === 'function'
        ? query(originalObj)
        : typeof query === 'object' && query !== null
        ? matchesQuery(originalObj, query, effectiveLogger)
        : false;

    if (shouldUpdate) {
      let newUpdatedObj;
      try {
        newUpdatedObj = isUpdateFunction
          ? updates({ ...originalObj })
          : { ...originalObj, ...updates };
      } catch (updateErr) {
        throw new DaitanOperationError(
          `Update function failed: ${updateErr.message}`
        );
      }

      if (
        schema &&
        validateAgainstSimpleSchema(newUpdatedObj, schema).length > 0
      ) {
        logJsonStoreOp(
          'warn',
          `Update for object skipped due to schema validation failure.`,
          filePath,
          { objectId: originalObj.id },
          effectiveLogger
        );
        updatedObjects.push(originalObj);
        continue;
      }
      updatedObjects.push(newUpdatedObj);
      updatedCount++;
    } else {
      updatedObjects.push(originalObj);
    }
  }

  if (updatedCount > 0) {
    try {
      const contentToWrite =
        updatedObjects.length > 0
          ? updatedObjects.map((obj) => JSON.stringify(obj)).join('\n') + '\n'
          : '';
      await fsPromises.writeFile(filePath, contentToWrite, 'utf-8');
      return { success: true, updatedCount };
    } catch (error) {
      throw new DaitanFileOperationError(
        `Failed to write data after update: ${error.message}`
      );
    }
  }
  return { success: true, updatedCount: 0 };
}

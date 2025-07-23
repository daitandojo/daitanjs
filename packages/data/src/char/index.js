// data/src/char/index.js
/**
 * @file Simple file-based key-value storage utilities.
 * @module @daitanjs/data/char
 *
 * @description
 * This module provides a simple, file-based key-value storage system where keys
 * are represented by an array of strings, and values are strings. Each record is
 * stored on a new line in a text file. This is suitable for simple data logging,
 * tracking, or storing associations where a full database is not necessary.
 *
 * The format for each line is: `key1:key2:key3=value`.
 *
 * Key Functions:
 * - `charSet`: Sets or updates a value for a given key array.
 * - `charGet`: Retrieves the value for a specific key array.
 * - `charDel`: Deletes a record by its key array.
 * - `charCount`: Counts the total number of records.
 * - `charClearAll`: Clears all records from the store file.
 * - `charBackup`: Creates a backup of the store file.
 *
 * Configuration:
 * - `CHAR_STORE_DEFAULT_PATH` (environment variable): Specifies the default file
 *   path for the character store. Defaults to a file in the OS temp directory or
 *   a local `.daitanjs_data` folder.
 */
import path from 'path';
import fs from 'fs';
import fsPromises from 'fs/promises';
import os from 'os';
import { getLogger } from '@daitanjs/development';
import { getConfigManager } from '@daitanjs/config';
import {
  DaitanFileOperationError,
  DaitanInvalidInputError,
} from '@daitanjs/error';

const charLogger = getLogger('daitan-data-char');

const DEFAULT_CHARSTORE_FILENAME = 'charStore.txt';
let DEFAULT_CHARSTORE_FILE_PATH_CACHE = null;
const KEY_DELIMITER = ':';
const VALUE_DELIMITER = '=';

/**
 * Determines and caches the default character store file path.
 * @private
 * @returns {string} The resolved absolute default file path.
 */
function getDefaultCharStoreFilePath() {
  if (DEFAULT_CHARSTORE_FILE_PATH_CACHE) {
    return DEFAULT_CHARSTORE_FILE_PATH_CACHE;
  }
  const configManager = getConfigManager();

  const configuredPath = configManager.get('CHAR_STORE_DEFAULT_PATH');
  if (configuredPath) {
    DEFAULT_CHARSTORE_FILE_PATH_CACHE = path.resolve(configuredPath);
  } else {
    try {
      const defaultBaseDir = path.join(
        os.tmpdir(),
        'daitanjs_data',
        'charstore'
      );
      // Use synchronous functions for this one-time setup to avoid race conditions.
      if (!fs.existsSync(defaultBaseDir)) {
        fs.mkdirSync(defaultBaseDir, { recursive: true });
      }
      DEFAULT_CHARSTORE_FILE_PATH_CACHE = path.join(
        defaultBaseDir,
        DEFAULT_CHARSTORE_FILENAME
      );
    } catch (e) {
      charLogger.warn(
        `Could not resolve os.tmpdir(), falling back to CWD for charstore. Error: ${e.message}`
      );
      const fallbackDir = path.resolve(
        process.cwd(),
        '.daitanjs_data',
        'charstore'
      );
      if (!fs.existsSync(fallbackDir)) {
        fs.mkdirSync(fallbackDir, { recursive: true });
      }
      DEFAULT_CHARSTORE_FILE_PATH_CACHE = path.join(
        fallbackDir,
        DEFAULT_CHARSTORE_FILENAME
      );
    }
  }
  charLogger.info(
    `Character store path resolved to: "${DEFAULT_CHARSTORE_FILE_PATH_CACHE}"`
  );
  return DEFAULT_CHARSTORE_FILE_PATH_CACHE;
}

/**
 * Ensures the store file and its directory exist.
 * @private
 * @param {string} filePath
 */
async function ensureFileExists(filePath) {
  try {
    const dir = path.dirname(filePath);
    await fsPromises.mkdir(dir, { recursive: true });
    await fsPromises
      .access(filePath, fs.constants.F_OK)
      .catch(async (error) => {
        if (error.code === 'ENOENT') {
          await fsPromises.writeFile(filePath, '', 'utf-8');
          charLogger.debug(`Created new empty char store file: "${filePath}"`);
        } else {
          throw error;
        }
      });
  } catch (error) {
    throw new DaitanFileOperationError(
      `Failed to ensure char store file exists at "${filePath}": ${error.message}`,
      { path: filePath, operation: 'ensureFile' },
      error
    );
  }
}

/**
 * Reads all records from the store file.
 * @private
 * @param {string} filePath
 * @returns {Promise<string[]>} Array of record lines.
 */
async function readAllRecords(filePath) {
  await ensureFileExists(filePath);
  try {
    const fileContent = await fsPromises.readFile(filePath, 'utf-8');
    return fileContent.trim() ? fileContent.trim().split('\n') : [];
  } catch (error) {
    throw new DaitanFileOperationError(
      `Failed to read from char store: ${error.message}`,
      { path: filePath, operation: 'read' },
      error
    );
  }
}

/**
 * Validates the key array.
 * @private
 * @param {string[]} keyArray
 */
function validateKeyArray(keyArray) {
  if (
    !Array.isArray(keyArray) ||
    keyArray.length === 0 ||
    !keyArray.every(
      (k) =>
        typeof k === 'string' &&
        k.trim() &&
        !k.includes(KEY_DELIMITER) &&
        !k.includes(VALUE_DELIMITER)
    )
  ) {
    throw new DaitanInvalidInputError(
      `Key must be a non-empty array of strings. Keys cannot contain "${KEY_DELIMITER}" or "${VALUE_DELIMITER}".`
    );
  }
}

/**
 * Sets a value for a given key array. Overwrites if the key already exists.
 * @public
 * @async
 * @param {object} params
 * @param {string[]} params.keyArray - The array of strings forming the key.
 * @param {string} params.value - The string value to set.
 * @param {string} [params.filePath] - Optional custom path to the store file.
 * @returns {Promise<void>}
 */
export async function charSet({ keyArray, value, filePath }) {
  validateKeyArray(keyArray);
  if (typeof value !== 'string') {
    throw new DaitanInvalidInputError('Value must be a string.');
  }

  const storePath = filePath || getDefaultCharStoreFilePath();
  const serializedKey = keyArray.join(KEY_DELIMITER);
  const newRecord = `${serializedKey}${VALUE_DELIMITER}${value}`;

  const allRecords = await readAllRecords(storePath);
  const existingRecordIndex = allRecords.findIndex((rec) =>
    rec.startsWith(`${serializedKey}${VALUE_DELIMITER}`)
  );

  if (existingRecordIndex !== -1) {
    allRecords[existingRecordIndex] = newRecord;
  } else {
    allRecords.push(newRecord);
  }

  try {
    await fsPromises.writeFile(storePath, allRecords.join('\n'), 'utf-8');
    charLogger.debug(`Set value for key "${serializedKey}" in "${storePath}"`);
  } catch (error) {
    throw new DaitanFileOperationError(
      `Failed to write to char store: ${error.message}`,
      { path: storePath, operation: 'write' },
      error
    );
  }
}

/**
 * Gets the value for a given key array.
 * @public
 * @async
 * @param {object} params
 * @param {string[]} params.keyArray - The key array to look for.
 * @param {string} [params.filePath] - Optional custom path.
 * @returns {Promise<string | null>} The found value or null if not found.
 */
export async function charGet({ keyArray, filePath }) {
  validateKeyArray(keyArray);
  const storePath = filePath || getDefaultCharStoreFilePath();
  const serializedKey = keyArray.join(KEY_DELIMITER);

  const allRecords = await readAllRecords(storePath);
  const record = allRecords.find((rec) =>
    rec.startsWith(`${serializedKey}${VALUE_DELIMITER}`)
  );

  if (record) {
    const value = record.substring(serializedKey.length + 1);
    charLogger.debug(`Got value for key "${serializedKey}"`);
    return value;
  }

  charLogger.debug(`Key "${serializedKey}" not found in char store.`);
  return null;
}

/**
 * Deletes a record by its key array.
 * @public
 * @async
 * @param {object} params
 * @param {string[]} params.keyArray - The key array to delete.
 * @param {string} [params.filePath] - Optional custom path.
 * @returns {Promise<boolean>} True if a record was deleted, false otherwise.
 */
export async function charDel({ keyArray, filePath }) {
  validateKeyArray(keyArray);
  const storePath = filePath || getDefaultCharStoreFilePath();
  const serializedKey = keyArray.join(KEY_DELIMITER);

  const allRecords = await readAllRecords(storePath);
  const filteredRecords = allRecords.filter(
    (rec) => !rec.startsWith(`${serializedKey}${VALUE_DELIMITER}`)
  );

  if (filteredRecords.length < allRecords.length) {
    try {
      await fsPromises.writeFile(
        storePath,
        filteredRecords.join('\n'),
        'utf-8'
      );
      charLogger.debug(`Deleted record for key "${serializedKey}"`);
      return true;
    } catch (error) {
      throw new DaitanFileOperationError(
        `Failed to write to char store after deletion: ${error.message}`,
        { path: storePath, operation: 'write' },
        error
      );
    }
  }

  charLogger.debug(`Key "${serializedKey}" not found for deletion.`);
  return false;
}

/**
 * Counts the total number of records in the store file.
 * @public
 * @async
 * @param {object} [options={}]
 * @param {string} [options.filePath] - Optional custom path.
 * @returns {Promise<number>} The total number of records.
 */
export async function charCount({ filePath } = {}) {
  const storePath = filePath || getDefaultCharStoreFilePath();
  const allRecords = await readAllRecords(storePath);
  return allRecords.length;
}

/**
 * Clears all records from the store file.
 * @public
 * @async
 * @param {object} [options={}]
 * @param {string} [options.filePath] - Optional custom path.
 * @returns {Promise<void>}
 */
export async function charClearAll({ filePath } = {}) {
  const storePath = filePath || getDefaultCharStoreFilePath();
  try {
    await fsPromises.writeFile(storePath, '', 'utf-8');
    charLogger.info(`Cleared all records from char store: "${storePath}"`);
  } catch (error) {
    throw new DaitanFileOperationError(
      `Failed to clear char store: ${error.message}`,
      { path: storePath, operation: 'write_truncate' },
      error
    );
  }
}

/**
 * Creates a backup of the current store file.
 * @public
 * @async
 * @param {object} [options={}]
 * @param {string} [options.filePath] - Optional custom path.
 * @returns {Promise<string>} The path to the created backup file.
 */
export async function charBackup({ filePath } = {}) {
  const storePath = filePath || getDefaultCharStoreFilePath();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${storePath}.bak.${timestamp}`;

  try {
    await fsPromises.copyFile(storePath, backupPath);
    charLogger.info(`Created backup of char store at: "${backupPath}"`);
    return backupPath;
  } catch (error) {
    if (error.code === 'ENOENT') {
      charLogger.warn(
        `Char store file "${storePath}" does not exist. Cannot create backup.`
      );
      throw new DaitanFileOperationError(
        `Cannot back up char store: Source file not found.`,
        { path: storePath, operation: 'backup_read' },
        error
      );
    }
    throw new DaitanFileOperationError(
      `Failed to create backup: ${error.message}`,
      { source: storePath, destination: backupPath },
      error
    );
  }
}

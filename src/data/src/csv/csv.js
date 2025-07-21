// data/src/csv/csv.js
/**
 * @file CSV file utility functions.
 * @module @daitanjs/data/csv/csv
 *
 * @description
 * This module provides utilities for handling CSV files, such as ensuring a file
 * exists with the correct headers before being used by other processes.
 */
import fs from 'fs/promises';
import path from 'path';
import { stringify as csvStringifySync } from 'csv-stringify/sync';
import { getLogger } from '@daitanjs/development';
import {
  DaitanFileOperationError,
  DaitanInvalidInputError,
} from '@daitanjs/error';

const csvUtilLogger = getLogger('daitan-csv-utils');

/**
 * Ensures a CSV file exists at the specified path. If the file does not exist,
 * it creates the file and writes the provided header row. If the file already
 * exists, it does nothing. This is useful for initializing log files or data stores.
 *
 * @public
 * @async
 * @param {object} params - Parameters for the function.
 * @param {string} params.filePath - The absolute or relative path to the target CSV file.
 * @param {string[]} params.headers - An array of strings representing the header columns for the CSV file.
 * @returns {Promise<void>} A promise that resolves when the file is verified to exist or is successfully created.
 * @throws {DaitanInvalidInputError} If `filePath` or `headers` are invalid (e.g., empty or wrong type).
 * @throws {DaitanFileOperationError} If the directory for the file cannot be created or if writing the file fails.
 */
export async function ensureCSVExists({ filePath, headers }) {
  const callId = `ensureCSV-${path.basename(
    filePath || 'unknown'
  )}-${Date.now().toString(36)}`;
  csvUtilLogger.debug(
    `[${callId}] ensureCSVExists: Called for path "${filePath}".`
  );

  if (!filePath || typeof filePath !== 'string' || !filePath.trim()) {
    throw new DaitanInvalidInputError('filePath must be a non-empty string.');
  }
  if (
    !Array.isArray(headers) ||
    headers.length === 0 ||
    !headers.every((h) => typeof h === 'string' && h.trim())
  ) {
    throw new DaitanInvalidInputError(
      'headers must be a non-empty array of non-empty strings.'
    );
  }

  const resolvedPath = path.resolve(filePath.trim());
  const dirPath = path.dirname(resolvedPath);

  try {
    // Check if file exists. This is the common case, so we check first.
    await fs.access(resolvedPath);
    csvUtilLogger.debug(
      `[${callId}] CSV file already exists at "${resolvedPath}". No action needed.`
    );
  } catch (error) {
    // If error is ENOENT (file not found), create it.
    if (error.code === 'ENOENT') {
      csvUtilLogger.info(
        `[${callId}] CSV file not found at "${resolvedPath}". Creating with specified headers.`
      );
      try {
        // Ensure the directory exists before writing the file
        await fs.mkdir(dirPath, { recursive: true });

        // Use csv-stringify to correctly format the header row (handles quoting, commas, etc.)
        const headerCsvString = csvStringifySync([headers]); // stringify expects an array of arrays

        // Write the header string to the new file
        await fs.writeFile(resolvedPath, headerCsvString, 'utf8');
        csvUtilLogger.info(
          `[${callId}] Successfully created CSV file with headers at "${resolvedPath}".`
        );
      } catch (writeError) {
        csvUtilLogger.error(
          `[${callId}] Failed to create or write to CSV file at "${resolvedPath}".`,
          { errorMessage: writeError.message }
        );
        throw new DaitanFileOperationError(
          `Failed to create CSV file "${resolvedPath}": ${writeError.message}`,
          { path: resolvedPath, operation: 'create' },
          writeError
        );
      }
    } else {
      // For other errors during fs.access (e.g., permission denied)
      csvUtilLogger.error(
        `[${callId}] Error accessing path "${resolvedPath}": ${error.message}`
      );
      throw new DaitanFileOperationError(
        `Failed to access CSV path "${resolvedPath}": ${error.message}`,
        { path: resolvedPath, operation: 'access' },
        error
      );
    }
  }
}

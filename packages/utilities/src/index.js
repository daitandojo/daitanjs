// utilities/src/index.js
/**
 * @file Main entry point for the @daitanjs/utilities package.
 * @module @daitanjs/utilities
 *
 * @description
 * This package provides a collection of general-purpose utility functions designed to be
 * robust, dependency-free (within DaitanJS), and widely applicable. The utilities cover
 * asynchronous operations (retries, batching), data manipulation (deep merge, truncate),
 * format validation (URL), and a comprehensive suite of file system helpers that wrap
 * Node.js's `fs/promises`.
 *
 * Key Features:
 * - `retryWithBackoff`: A powerful async function retrier with exponential backoff and jitter.
 * - `processInBatches`: Efficiently processes a large array of items in smaller, manageable chunks.
 * - `isRetryableError`: A helper to determine if an error is likely due to a transient network or server issue.
 * - `deepMerge`: A utility for deep merging plain JavaScript objects.
 * - A full suite of async file system wrappers (`readFile`, `writeFile`, etc.) that ensure directories exist and handle path resolution.
 * - Various string and data structure helpers like `truncateString`, `groupBy`, and `replacePlaceholders`.
 */

import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';

export * from './security.js'

export * from './async/timeOut.js'

/** @private */
const noOpLogger = {
  error: () => {},
  warn: () => {},
  info: () => {},
  http: () => {},
  verbose: () => {},
  debug: () => {},
  silly: () => {},
  child: function () {
    return this;
  },
};

/**
 * Safely executes an asynchronous operation, returning its result or null on failure.
 * Optionally calls a custom error handler.
 * @public
 * @async
 * @param {() => Promise<any>} operation - The async function to execute.
 * @param {object} [options={}] - Options for execution.
 * @param {(error: any) => void} [options.errorHandler] - A function to call if the operation throws an error.
 * @returns {Promise<any | null>} The result of the operation, or null if it failed.
 */
export const safeExecute = async (operation, options = {}) => {
  const { errorHandler } = options;
  try {
    if (typeof operation !== 'function') {
      // Use console.error as this is a low-level utility without a logger dependency.
      console.error(
        "@daitanjs/utilities/safeExecute: 'operation' must be a function."
      );
      return null;
    }
    return await operation();
  } catch (error) {
    if (errorHandler && typeof errorHandler === 'function') {
      try {
        errorHandler(error);
      } catch (handlerError) {
        console.error(
          '@daitanjs/utilities/safeExecute: Error within provided errorHandler:',
          handlerError
        );
      }
    }
    return null;
  }
};

/**
 * Retries an asynchronous operation with exponential backoff and jitter if it fails.
 * @public
 * @async
 * @param {() => Promise<any>} operation - The async function to attempt.
 * @param {number} maxRetries - The maximum number of retry attempts (e.g., 3 means 1 initial + 3 retries).
 * @param {object} [options={}] - Configuration for the retry logic.
 * @param {import('winston').Logger} [options.loggerInstance=noOpLogger] - A logger for verbose output.
 * @param {string} [options.operationName='Unnamed Operation'] - A name for the operation for logging.
 * @param {number} [options.initialDelayMs=1000] - The base delay for the first retry.
 * @param {number} [options.maxDelayMs=30000] - The maximum delay between retries.
 * @param {(error: any) => boolean} [options.isRetryable=() => true] - A function to determine if an error is retryable.
 * @returns {Promise<any>} The result of the successful operation.
 * @throws {any} The last error encountered if all retries fail.
 */
export async function retryWithBackoff(operation, maxRetries, options = {}) {
  const {
    loggerInstance = noOpLogger,
    operationName = 'Unnamed Operation',
    initialDelayMs = 1000,
    maxDelayMs = 30000,
    isRetryable = () => true, // Default to retrying on any error
  } = options;

  if (typeof operation !== 'function') {
    throw new TypeError(`[${operationName}] 'operation' must be a function.`);
  }
  if (typeof maxRetries !== 'number' || maxRetries < 0) {
    throw new TypeError(
      `[${operationName}] 'maxRetries' must be a non-negative number.`
    );
  }

  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        loggerInstance.debug(
          `[${operationName}] Retrying (Attempt ${attempt} of ${maxRetries})...`
        );
      } else {
        loggerInstance.debug(`[${operationName}] Attempting operation...`);
      }
      return await operation();
    } catch (error) {
      lastError = error;
      loggerInstance.warn(
        `[${operationName}] Attempt ${attempt + 1}/${maxRetries + 1} failed: ${
          error.message
        }`
      );

      if (!isRetryable(error)) {
        loggerInstance.error(
          `[${operationName}] Non-retryable error encountered. Aborting retries.`,
          { error }
        );
        throw lastError;
      }
      if (attempt >= maxRetries) {
        loggerInstance.error(
          `[${operationName}] All ${
            maxRetries + 1
          } attempts failed. Last error: ${error.message}`
        );
        break;
      }

      const delayWithBase = initialDelayMs * Math.pow(2, attempt);
      const jitter = delayWithBase * 0.2 * (Math.random() - 0.5); // +/- 10% jitter
      const currentDelay = Math.min(
        maxDelayMs,
        Math.round(delayWithBase + jitter)
      );

      loggerInstance.info(
        `[${operationName}] Retrying in ${currentDelay / 1000}s...`
      );
      await new Promise((resolve) => setTimeout(resolve, currentDelay));
    }
  }
  throw lastError;
}

/**
 * Processes a large array of items in smaller, manageable batches.
 * @public
 * @async
 * @param {Array<any>} items - The array of items to process.
 * @param {number} batchSize - The size of each batch.
 * @param {(batch: Array<any>, batchIndex: number, totalBatches: number) => Promise<any>} processBatchAsync - An async function that processes one batch.
 * @param {object} [options={}] - Options for batch processing.
 * @param {import('winston').Logger} [options.loggerInstance=noOpLogger] - A logger for verbose output.
 * @param {string} [options.processingJobName='BatchJob'] - A name for the job for logging.
 * @returns {Promise<Array<any>>} An array of results aggregated from each batch process.
 */
export async function processInBatches(
  items,
  batchSize,
  processBatchAsync,
  options = {}
) {
  const { loggerInstance = noOpLogger, processingJobName = 'BatchJob' } =
    options;

  if (!Array.isArray(items)) {
    throw new TypeError(`[${processingJobName}] 'items' must be an array.`);
  }
  if (
    typeof batchSize !== 'number' ||
    !Number.isInteger(batchSize) ||
    batchSize <= 0
  ) {
    throw new TypeError(
      `[${processingJobName}] 'batchSize' must be a positive integer.`
    );
  }
  if (typeof processBatchAsync !== 'function') {
    throw new TypeError(
      `[${processingJobName}] 'processBatchAsync' must be a function.`
    );
  }

  const allResults = [];
  if (items.length === 0) {
    loggerInstance.info(`[${processingJobName}] No items to process.`);
    return allResults;
  }

  const totalBatches = Math.ceil(items.length / batchSize);
  loggerInstance.info(
    `[${processingJobName}] Starting to process ${items.length} items in ${totalBatches} batches of size ${batchSize}.`
  );

  for (let i = 0; i < totalBatches; i++) {
    const batchStartIndex = i * batchSize;
    const batchEndIndex = batchStartIndex + batchSize;
    const currentBatch = items.slice(batchStartIndex, batchEndIndex);
    const batchNumber = i + 1;
    loggerInstance.debug(
      `[${processingJobName}] Processing batch ${batchNumber}/${totalBatches}...`
    );
    try {
      const batchResult = await processBatchAsync(
        currentBatch,
        i, // 0-indexed batch number
        totalBatches
      );
      if (batchResult !== undefined && batchResult !== null) {
        if (Array.isArray(batchResult)) {
          allResults.push(...batchResult);
        } else {
          allResults.push(batchResult);
        }
      }
      loggerInstance.debug(
        `[${processingJobName}] Batch ${batchNumber}/${totalBatches} processed successfully.`
      );
    } catch (error) {
      loggerInstance.error(
        `[${processingJobName}] Error processing batch ${batchNumber}/${totalBatches}: ${error.message}`,
        { errorName: error.name, batchContentPreview: currentBatch.slice(0, 3) }
      );
      throw error; // Re-throw to halt the entire process on a batch failure
    }
  }
  loggerInstance.info(
    `[${processingJobName}] Finished processing all ${totalBatches} batches. Total results collected: ${allResults.length}.`
  );
  return allResults;
}

/**
 * Truncates a string to a specified maximum length, appending an ellipsis if truncated.
 * @public
 * @param {any} str - The value to truncate. If not a string, it will be converted.
 * @param {number} [maxLength=100] - The maximum length of the string (including ellipsis).
 * @param {string} [ellipsis='...'] - The ellipsis string to append.
 * @returns {string} The truncated string.
 */
export function truncateString(str, maxLength = 100, ellipsis = '...') {
  if (typeof str !== 'string') {
    try {
      str = String(str ?? ''); // Convert null/undefined to empty string
    } catch {
      return '[Unstringifiable]';
    }
  }
  if (
    typeof maxLength !== 'number' ||
    !Number.isInteger(maxLength) ||
    maxLength <= 0
  ) {
    return str; // Return original string if maxLength is invalid
  }
  if (str.length <= maxLength) {
    return str;
  }
  if (maxLength <= ellipsis.length) {
    return ellipsis.substring(0, maxLength);
  }
  return str.substring(0, maxLength - ellipsis.length) + ellipsis;
}

/**
 * Checks if a string is a valid CSS class name selector (basic check).
 * @public
 * @param {string} className - The string to validate.
 * @returns {boolean} True if the string is a valid class name.
 */
export function isValidCSSSelector(className) {
  if (typeof className !== 'string' || !className.trim()) {
    return false;
  }
  // This is a basic regex and doesn't cover all edge cases of CSS identifiers,
  // but it's good for preventing most injection or syntax errors.
  const cssClassNameRegex = /^-?[_a-zA-Z]+[_a-zA-Z0-9-]*$/;
  return cssClassNameRegex.test(className.trim());
}

/**
 * Safely extracts a property from each object in an array.
 * @public
 * @param {Array<object>} dataArray - Array of objects.
 * @param {string} propertyKey - The key of the property to extract.
 * @returns {Array<any>} An array of the extracted property values.
 */
export function safelyExtractProperty(dataArray, propertyKey) {
  if (!Array.isArray(dataArray)) return [];
  if (typeof propertyKey !== 'string' || !propertyKey.trim()) return [];

  return dataArray
    .filter(
      (item) =>
        item &&
        typeof item === 'object' &&
        Object.prototype.hasOwnProperty.call(item, propertyKey)
    )
    .map((item) => item[propertyKey])
    .filter((value) => value !== null && value !== undefined);
}

/**
 * Logs a summary object to the console in a readable format.
 * @public
 * @param {object} summary - The object to log.
 * @param {import('winston').Logger} [loggerInstance=noOpLogger] - A logger instance.
 */
export function printSummary(summary, loggerInstance = noOpLogger) {
  if (typeof summary !== 'object' || summary === null) {
    loggerInstance.error(
      '@daitanjs/utilities: Invalid summary object provided to printSummary.'
    );
    return;
  }
  if (Object.keys(summary).length === 0) {
    loggerInstance.info('📊 Summary: (empty)');
    return;
  }
  loggerInstance.info('📊 Summary:');
  for (const [key, value] of Object.entries(summary)) {
    const valueStr =
      typeof value === 'object' && value !== null
        ? JSON.stringify(value)
        : String(value);
    loggerInstance.info(`  ${key}: ${truncateString(valueStr, 150)}`);
  }
}

/**
 * Checks if an item is a plain JavaScript object.
 * @public
 * @param {any} item - The item to check.
 * @returns {boolean} True if the item is a plain object.
 */
export function isObject(item) {
  return (
    item !== null &&
    typeof item === 'object' &&
    !Array.isArray(item) &&
    item.constructor === Object
  );
}

/**
 * Deeply merges properties from source objects into a target object.
 * @public
 * @param {object} target - The object to merge into.
 * @param {...object} sources - The source objects to merge from.
 * @returns {object} The modified target object.
 */
export function deepMerge(target, ...sources) {
  if (!isObject(target)) {
    throw new TypeError('Target for deepMerge must be a plain object.');
  }

  for (const source of sources) {
    if (isObject(source)) {
      for (const key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
          if (isObject(source[key]) && isObject(target[key])) {
            deepMerge(target[key], source[key]);
          } else {
            target[key] = source[key];
          }
        }
      }
    }
  }
  return target;
}

/**
 * A simple promise-based delay function.
 * @public
 * @param {number} ms - The delay in milliseconds.
 * @returns {Promise<void>}
 */
export function delay(ms) {
  if (typeof ms !== 'number' || ms < 0 || isNaN(ms)) {
    throw new TypeError('Delay `ms` must be a non-negative number.');
  }
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Groups an array of objects by a specified property key.
 * @public
 * @param {Array<object>} dataArray - The array of objects to group.
 * @param {string} propertyKey - The key to group by.
 * @returns {Object.<string, Array<object>>} An object where keys are the grouped values and values are arrays of matching objects.
 */
export function groupBy(dataArray, propertyKey) {
  if (!Array.isArray(dataArray)) {
    return {};
  }
  if (typeof propertyKey !== 'string' || !propertyKey.trim()) {
    return {};
  }

  return dataArray.reduce((acc, obj) => {
    if (
      obj &&
      typeof obj === 'object' &&
      Object.prototype.hasOwnProperty.call(obj, propertyKey)
    ) {
      const key = obj[propertyKey];
      const groupKey = String(key);
      if (!acc[groupKey]) {
        acc[groupKey] = [];
      }
      acc[groupKey].push(obj);
    }
    return acc;
  }, {});
}

/**
 * Generates a random alphanumeric string of a given length.
 * @public
 * @param {number} [length=8] - The desired length of the string.
 * @returns {string} The random string.
 */
export function generateRandomString(length = 8) {
  if (typeof length !== 'number' || !Number.isInteger(length) || length <= 0) {
    throw new TypeError(
      'Length for generateRandomString must be a positive integer.'
    );
  }
  const characters =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

/**
 * Validates if a string is a syntactically valid URL.
 * @public
 * @param {string} urlString - The string to validate.
 * @returns {boolean} True if the string is a valid URL, false otherwise.
 */
export function isValidURL(urlString) {
  if (typeof urlString !== 'string' || !urlString.trim()) {
    return false;
  }
  try {
    new URL(urlString);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Replaces placeholders in a template string with values from an object.
 * Placeholders should be in the format `{{key}}`.
 * @public
 * @param {object} params
 * @param {string} params.templateString - The template string with placeholders.
 * @param {object} params.placeholders - An object with key-value pairs for replacement.
 * @returns {string} The formatted string.
 */
export const replacePlaceholders = ({ templateString, placeholders }) => {
  if (typeof templateString !== 'string') {
    return templateString;
  }
  if (!templateString.includes('{{')) {
    return templateString; // No placeholders to replace
  }
  if (!isObject(placeholders)) {
    throw new TypeError(
      '`placeholders` must be an object when templateString contains placeholders.'
    );
  }
  let result = templateString;
  for (const key in placeholders) {
    if (Object.prototype.hasOwnProperty.call(placeholders, key)) {
      // Create a regex for the placeholder to replace all occurrences
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, String(placeholders[key]));
    }
  }
  return result;
};

/**
 * Formats raw scraped link data into a standardized structure.
 * @public
 * @param {Array<object>} extractedRawItems - Array of raw items from a scraper.
 * @param {string} baseUrl - The base URL of the scraped site, for resolving relative links.
 * @param {string} sourceIdentifier - A string identifying the source (e.g., 'BBC News').
 * @param {object} [options={}] - Formatting options.
 * @param {import('winston').Logger} [options.loggerInstance=noOpLogger] - Logger instance.
 * @param {string} [options.sourceNameForLog] - More descriptive name for logging.
 * @param {number} [options.minTitleLength=5] - Minimum length for a headline to be considered valid.
 * @returns {Array<object>} An array of formatted, standardized link objects.
 */
export function formatScrapedLinkData(
  extractedRawItems,
  baseUrl,
  sourceIdentifier,
  options = {}
) {
  const {
    loggerInstance = noOpLogger,
    sourceNameForLog,
    minTitleLength = 5,
  } = options;
  const effectiveSourceNameForLog =
    sourceNameForLog || sourceIdentifier || 'UnknownSource';
  const logContextPrefix = `@daitanjs/utilities [${effectiveSourceNameForLog}] formatScrapedLinkData`;

  if (!Array.isArray(extractedRawItems)) {
    loggerInstance.warn(
      `${logContextPrefix}: Expected extractedRawItems to be an array, got ${typeof extractedRawItems}. Returning empty array.`
    );
    return [];
  }
  if (!isValidURL(baseUrl)) {
    loggerInstance.error(
      `${logContextPrefix}: Invalid baseUrl provided: "${baseUrl}". Cannot process items.`
    );
    return [];
  }
  if (
    !sourceIdentifier ||
    typeof sourceIdentifier !== 'string' ||
    !sourceIdentifier.trim()
  ) {
    loggerInstance.warn(
      `${logContextPrefix}: Invalid or missing sourceIdentifier. Using 'unknown_source_identifier'.`
    );
    sourceIdentifier = 'unknown_source_identifier';
  }

  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  let validCount = 0;
  let invalidCount = 0;

  const formattedItems = extractedRawItems
    .map((item, idx) => {
      if (!isObject(item)) {
        loggerInstance.debug(
          `${logContextPrefix}: Item at index ${idx} is not an object or is null. Skipping.`
        );
        invalidCount++;
        return null;
      }
      const headline = String(item.title || item.text || '').trim();
      let link = String(item.url || item.link || '').trim();
      if (!headline || headline.length < minTitleLength) {
        invalidCount++;
        return null;
      }
      if (!link) {
        invalidCount++;
        return null;
      }
      let resolvedLink;
      try {
        if (link.startsWith('http://') || link.startsWith('https://')) {
          resolvedLink = link;
        } else if (link.startsWith('//')) {
          const baseProto = new URL(normalizedBaseUrl).protocol;
          resolvedLink = `${baseProto}${link}`;
        } else {
          resolvedLink = new URL(link, normalizedBaseUrl).href;
        }
      } catch (urlError) {
        invalidCount++;
        return null;
      }
      if (!isValidURL(resolvedLink)) {
        invalidCount++;
        return null;
      }
      validCount++;
      return {
        headline,
        link: resolvedLink,
        newspaper: sourceIdentifier,
        source: sourceIdentifier,
        ...(item.section && { section: String(item.section).trim() }),
        ...(item.author && { author: String(item.author).trim() }),
        ...(item.published && { published: String(item.published).trim() }),
        ...(item.position !== undefined &&
          item.position !== null && { position: item.position }),
        ...(item.raw && { raw: item.raw }),
      };
    })
    .filter(Boolean); // Remove null entries from the array

  if (extractedRawItems.length > 0 || invalidCount > 0) {
    loggerInstance.info(
      `${logContextPrefix}: Processed ${extractedRawItems.length} raw items. Formatted: ${validCount}, Skipped/Invalid: ${invalidCount}.`
    );
  }
  return formattedItems;
}

// --- File System Utilities ---
const fileSystemLogger = noOpLogger;
const validatePath = (
  itemPath,
  operationName,
  loggerInstance = fileSystemLogger
) => {
  if (!itemPath || typeof itemPath !== 'string' || !itemPath.trim()) {
    const errMsg = `${operationName}: Path argument is required and must be a non-empty string. Received: "${itemPath}"`;
    loggerInstance.error(errMsg);
    throw new TypeError(errMsg);
  }
};

/**
 * Synchronously ensures a directory exists. Creates it recursively if it doesn't.
 * @public
 * @param {string} dirPath - The path to the directory.
 * @param {object} [options={}]
 * @param {import('winston').Logger} [options.loggerInstance] - Optional logger.
 */
export function ensureDirectoryExistsSync(dirPath, options = {}) {
  const loggerInstance = options.loggerInstance || fileSystemLogger;
  validatePath(dirPath, 'ensureDirectoryExistsSync', loggerInstance);
  const resolvedPath = path.resolve(dirPath.trim());
  if (!fs.existsSync(resolvedPath)) {
    loggerInstance.info(
      `[ensureDirectoryExistsSync] Creating: "${resolvedPath}"`
    );
    fs.mkdirSync(resolvedPath, { recursive: true });
  }
}

/**
 * Asynchronously creates a directory, including any necessary parent directories.
 * @public
 * @async
 * @param {string} dirPath - The path to the directory.
 * @returns {Promise<string | undefined>} The path of the first directory created, or undefined if it already existed.
 */
export async function createDirectory(dirPath) {
  validatePath(dirPath, 'createDirectory');
  const resolvedPath = path.resolve(dirPath.trim());
  return fsPromises.mkdir(resolvedPath, { recursive: true });
}

/**
 * Asynchronously ensures a directory exists. Alias for `createDirectory`.
 * @public
 */
export async function ensureDirectoryExists(dirPath) {
  return createDirectory(dirPath);
}

/**
 * Asynchronously reads the entire contents of a file.
 * @public
 */
export async function readFile(filePath) {
  validatePath(filePath, 'readFile');
  const resolvedPath = path.resolve(filePath.trim());
  return fsPromises.readFile(resolvedPath, 'utf8');
}

/**
 * Asynchronously writes data to a file, replacing the file if it already exists.
 * @public
 */
export async function writeFile(filePath, data, options = {}) {
  validatePath(filePath, 'writeFile');
  if (data === undefined || data === null) {
    throw new TypeError('Data to write cannot be undefined or null.');
  }
  const resolvedPath = path.resolve(filePath.trim());
  const encoding = options.encoding || 'utf8';
  await ensureDirectoryExists(path.dirname(resolvedPath));
  await fsPromises.writeFile(resolvedPath, data, encoding);
}

/**
 * Asynchronously deletes a file. Does not throw an error if the file does not exist.
 * @public
 */
export async function deleteFile(filePath) {
  validatePath(filePath, 'deleteFile');
  const resolvedPath = path.resolve(filePath.trim());
  try {
    await fsPromises.unlink(resolvedPath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      // Re-throw errors other than "file not found"
      throw error;
    }
  }
}

/**
 * Asynchronously reads the contents of a directory.
 * @public
 */
export async function listDirectory(dirPath) {
  validatePath(dirPath, 'listDirectory');
  const resolvedPath = path.resolve(dirPath.trim());
  return fsPromises.readdir(resolvedPath);
}

/**
 * Asynchronously gets the contents of a directory recursively.
 * @public
 */
export async function getDirectoryContentsRecursive(
  dirPath,
  options = {},
  currentDepth = 0
) {
  if (currentDepth === 0) {
    validatePath(dirPath, 'getDirectoryContentsRecursive');
  }
  const { maxDepth = Infinity, filterRegex, includeStats = true } = options;

  if (currentDepth > maxDepth) return [];

  const resolvedPath = path.resolve(dirPath.trim());
  let allItems = [];
  const entries = await fsPromises.readdir(resolvedPath, {
    withFileTypes: true,
  });
  for (const entry of entries) {
    if (filterRegex && !filterRegex.test(entry.name)) continue;

    const itemPath = path.join(resolvedPath, entry.name);
    let itemType = entry.isDirectory()
      ? 'directory'
      : entry.isFile()
      ? 'file'
      : 'other';
    let statsDetails = {};

    if (includeStats) {
      try {
        const stats = await fsPromises.stat(itemPath);
        statsDetails = {
          size: stats.size,
          createdAt: stats.birthtime,
          modifiedAt: stats.mtime,
        };
      } catch (e) {
        /* ignore stat errors for individual items */
      }
    }

    allItems.push({
      name: entry.name,
      path: itemPath,
      type: itemType,
      ...statsDetails,
    });

    if (itemType === 'directory') {
      allItems = allItems.concat(
        await getDirectoryContentsRecursive(itemPath, options, currentDepth + 1)
      );
    }
  }
  return allItems;
}

/**
 * Asynchronously copies a file.
 * @public
 */
export async function copyFile(sourcePath, destinationPath) {
  validatePath(sourcePath, 'copyFile source');
  validatePath(destinationPath, 'copyFile destination');
  await ensureDirectoryExists(path.dirname(destinationPath));
  await fsPromises.copyFile(
    path.resolve(sourcePath),
    path.resolve(destinationPath)
  );
}

/**
 * Asynchronously renames a file or directory.
 * @public
 */
export async function renameFileOrDirectory(oldPath, newPath) {
  validatePath(oldPath, 'rename oldPath');
  validatePath(newPath, 'rename newPath');
  // Ensure the *new* directory exists before renaming/moving
  await ensureDirectoryExists(path.dirname(newPath));
  await fsPromises.rename(path.resolve(oldPath), path.resolve(newPath));
}

/**
 * Asynchronously gets file status information.
 * @public
 */
export async function getFileStats(itemPath) {
  validatePath(itemPath, 'getFileStats');
  return fsPromises.stat(path.resolve(itemPath.trim()));
}

/**
 * Determines if an error is likely retryable based on common patterns.
 * @public
 * @param {any} error - The error object to inspect.
 * @returns {boolean} True if the error is deemed retryable, false otherwise.
 */
export const isRetryableError = (error) => {
  if (!error) return false;

  // Favor checking for a property on our custom errors first
  const daitanError = error.name?.startsWith('Daitan')
    ? error
    : error.originalError;

  const httpStatusCode =
    daitanError?.httpStatusCode || error.response?.status || error.status;
  if (typeof httpStatusCode === 'number') {
    if ([408, 429, 500, 502, 503, 504].includes(httpStatusCode)) {
      return true;
    }
  }

  const errorCode = String(daitanError?.code || error.code || '').toUpperCase();
  const retryableErrorCodes = [
    'ECONNRESET',
    'ETIMEDOUT',
    'EAI_AGAIN',
    'ESOCKETTIMEDOUT',
    'ECONNABORTED',
    'ECONNREFUSED',
    'TIMEOUT',
    'NETWORK_ERROR',
    'SERVICE_UNAVAILABLE',
  ];
  if (errorCode && retryableErrorCodes.includes(errorCode)) {
    return true;
  }

  const errorMessage = String(error.message || '').toLowerCase();
  const retryableMessageFragments = [
    'timeout',
    'timed out',
    'network error',
    'connection refused',
    'econnrefused',
    'connection reset',
    'econnreset',
    'service unavailable',
    'server error',
    'rate limit',
    'throttled',
    'too many requests',
    'eai_again',
    'gateway timed out',
    'please try again',
    'transient fault',
    'socket hang up',
  ];
  if (
    retryableMessageFragments.some((fragment) =>
      errorMessage.includes(fragment)
    )
  ) {
    return true;
  }

  return false;
};

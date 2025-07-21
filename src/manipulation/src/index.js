// manipulation/src/index.js
/**
 * @file Main entry point for the @daitanjs/manipulation package.
 * @module @daitanjs/manipulation
 *
 * @description
 * This package provides a suite of utilities for common data manipulation tasks,
 * focusing on dates, JSON structures, and strings. It aims to offer robust,
 * well-documented, and easy-to-use functions for everyday development needs.
 *
 * Key Features:
 * - Date conversion (e.g., US to UK format).
 * - JSON cleaning, safe parsing, and validation.
 * - String escaping, truncation, case conversion, and character type checking.
 *
 * All functions are designed with error handling and logging (via `@daitanjs/development`)
 * in mind, throwing specific DaitanJS errors for invalid inputs or operational failures.
 */

import { getLogger } from '@daitanjs/development';

const manipulationIndexLogger = getLogger('daitan-manipulation-index');

manipulationIndexLogger.debug('Exporting DaitanJS Manipulation utilities...');

// --- Date Utilities ---
export { convertUSDateToUKDate } from './dates.js';
// Future date functions (examples, not yet implemented in dates.js):
// export { formatDate, addDays, dateDifference, isLeapYear, getDayOfWeek } from './dates.js';

// --- JSON Utilities ---
export {
  cleanJSONString,
  deepCleanJSON,
  safeParseJSON,
  validateJSON,
} from './json.js';

// --- String Utilities ---
export {
  addEscapes,
  escapeObjectStrings, // Renamed from escapeObject for clarity
  truncate,
  toTitleCase,
  isAlpha,
  isAlphanumeric,
  isNumeric,
  reverseString,
  // Potential new string utils:
  // e.g., toKebabCase, toSnakeCase, toCamelCase,
  // e.g., countOccurrences, removeWhitespace, padString
} from './strings.js';

manipulationIndexLogger.info(
  'DaitanJS Manipulation module exports configured and ready.'
);

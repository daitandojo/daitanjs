// manipulation/src/strings.js
/**
 * @file String manipulation utilities.
 * @module @daitanjs/manipulation/strings
 */
import { getLogger } from '@daitanjs/development';
import { DaitanInvalidInputError } from '@daitanjs/error';

const logger = getLogger('daitan-manipulation-strings');

/**
 * Escapes special characters in a string for safe use in contexts like
 * JSON string values or general string literals within generated code.
 *
 * @public
 * @param {string} str - The string to escape.
 * @returns {string} The escaped string.
 * @throws {DaitanInvalidInputError} If input `str` is not a string.
 */
export const addEscapes = (str) => {
  if (typeof str !== 'string') {
    throw new DaitanInvalidInputError('Input to addEscapes must be a string.');
  }
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/\f/g, '\\f')
    .replace(/\b/g, '\\b');
};

/**
 * Recursively escapes special characters in all string values within an object or array.
 * @public
 * @param {any} data - The data structure (object, array, or single string) to process.
 * @returns {any} A new data structure with all string values escaped.
 */
export const escapeObjectStrings = (data) => {
  if (typeof data === 'string') {
    return addEscapes(data);
  } else if (Array.isArray(data)) {
    return data.map((item) => escapeObjectStrings(item));
  } else if (data && typeof data === 'object') {
    const escapedObject = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        escapedObject[key] = escapeObjectStrings(data[key]);
      }
    }
    return escapedObject;
  }
  return data;
};

/**
 * Truncates a string to a specified maximum length, appending an ellipsis if truncated.
 *
 * @public
 * @param {string} str - The string to truncate.
 * @param {number} [maxLength=100] - The maximum length of the string (including ellipsis).
 * @param {string} [ellipsis='...'] - The ellipsis string to append.
 * @returns {string} The truncated string.
 * @throws {DaitanInvalidInputError} If inputs are invalid.
 */
export const truncate = (str, maxLength = 100, ellipsis = '...') => {
  if (typeof str !== 'string') {
    throw new DaitanInvalidInputError(
      'Input `str` to truncate must be a string.'
    );
  }
  if (typeof maxLength !== 'number' || isNaN(maxLength) || maxLength <= 0) {
    throw new DaitanInvalidInputError(
      'maxLength for truncate must be a positive number.'
    );
  }
  if (typeof ellipsis !== 'string') {
    throw new DaitanInvalidInputError(
      'ellipsis for truncate must be a string.'
    );
  }

  if (str.length <= maxLength) {
    return str;
  }
  if (maxLength <= ellipsis.length) {
    return ellipsis.substring(0, maxLength);
  }
  return str.substring(0, maxLength - ellipsis.length) + ellipsis;
};

/**
 * Converts a string to Title Case.
 * @public
 * @param {string} str - The input string.
 * @returns {string} The string in Title Case.
 * @throws {DaitanInvalidInputError} If input `str` is not a string.
 */
export const toTitleCase = (str) => {
  if (typeof str !== 'string') {
    throw new DaitanInvalidInputError(
      'Input `str` to toTitleCase must be a string.'
    );
  }
  if (!str.trim()) return '';
  return str.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
};

/**
 * Checks if a string contains only alphabetic characters.
 * @public
 * @param {string} str - The input string.
 * @returns {boolean} True if the string is purely alphabetic and non-empty.
 * @throws {DaitanInvalidInputError} If input `str` is not a string.
 */
export const isAlpha = (str) => {
  if (typeof str !== 'string') {
    throw new DaitanInvalidInputError(
      'Input `str` to isAlpha must be a string.'
    );
  }
  return /^[a-zA-Z]+$/.test(str);
};

/**
 * Checks if a string contains only alphanumeric characters.
 * @public
 * @param {string} str - The input string.
 * @returns {boolean} True if the string is purely alphanumeric and non-empty.
 * @throws {DaitanInvalidInputError} If input `str` is not a string.
 */
export const isAlphanumeric = (str) => {
  if (typeof str !== 'string') {
    throw new DaitanInvalidInputError(
      'Input `str` to isAlphanumeric must be a string.'
    );
  }
  return /^[a-zA-Z0-9]+$/.test(str);
};

/**
 * Checks if a string contains only numeric characters.
 * @public
 * @param {string} str - The input string.
 * @returns {boolean} True if the string is purely numeric and non-empty.
 * @throws {DaitanInvalidInputError} If input `str` is not a string.
 */
export const isNumeric = (str) => {
  if (typeof str !== 'string') {
    throw new DaitanInvalidInputError(
      'Input `str` to isNumeric must be a string.'
    );
  }
  return /^[0-9]+$/.test(str);
};

/**
 * Reverses a string.
 * @public
 * @param {string} str - The input string.
 * @returns {string} The reversed string.
 * @throws {DaitanInvalidInputError} If input `str` is not a string.
 */
export const reverseString = (str) => {
  if (typeof str !== 'string') {
    throw new DaitanInvalidInputError(
      'Input `str` to reverseString must be a string.'
    );
  }
  return str.split('').reverse().join('');
};

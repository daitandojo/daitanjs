// manipulation/src/json.js
/**
 * @file JSON manipulation utilities.
 * @module @daitanjs/manipulation/json
 */
import { getLogger } from '@daitanjs/development';
import { DaitanInvalidInputError, DaitanOperationError } from '@daitanjs/error';

const logger = getLogger('daitan-manipulation-json');

/**
 * Generates detailed error messages for invalid JSON, including context from the string.
 * This helps pinpoint where parsing failed.
 * @private
 * @param {SyntaxError | Error} error - The JSON parsing error object.
 * @param {string} jsonString - The JSON string that caused the error.
 * @returns {string} A detailed error message string.
 */
function generateJSONErrorDetails(error, jsonString) {
  const positionMatch = error.message.match(/position (\d+)/i);
  let enhancedError = `JSON Error: ${error.message}`;

  if (positionMatch && positionMatch[1]) {
    const position = parseInt(positionMatch[1], 10);
    if (!isNaN(position)) {
      const contextChars = 25;
      const start = Math.max(0, position - contextChars);
      const end = Math.min(jsonString.length, position + 1 + contextChars);
      let nearText = jsonString.substring(start, end);
      nearText = nearText.replace(/\n/g, '\\n').replace(/\r/g, '\\r');
      const pointerOffset = position - start;
      const pointerLine = ' '.repeat(pointerOffset) + '^';
      enhancedError += `\n  Context: "${nearText}"\n           ${pointerLine}`;
    }
  }
  return enhancedError;
}

/**
 * Cleans up a string that is supposed to be a JSON string by removing
 * common problematic characters and normalizing whitespace. This is a heuristic
 * approach and works best for common LLM output quirks or copy-paste errors.
 * It does not guarantee valid JSON if the input structure is fundamentally broken.
 *
 * @public
 * @param {string} input - The JSON-like string to be cleaned.
 * @returns {string} Cleaned JSON-like string. Returns the original input if it's not a string or is empty/whitespace only.
 */
export function cleanJSONString(input) {
  if (typeof input !== 'string' || !input.trim()) {
    if (typeof input === 'string' && input.length > 0 && !input.trim()) {
      logger.debug(
        'cleanJSONString: Input string is whitespace only. Returning empty string.'
      );
      return '';
    }
    logger.debug(
      'cleanJSONString: Input is not a string or is effectively empty. Returning as is.',
      { inputType: typeof input }
    );
    return input;
  }

  let cleaned = input;
  const originalLength = cleaned.length;

  const firstBracket = cleaned.indexOf('{');
  const firstSquareBracket = cleaned.indexOf('[');
  let startIndex = -1;
  if (firstBracket !== -1 && firstSquareBracket !== -1) {
    startIndex = Math.min(firstBracket, firstSquareBracket);
  } else {
    startIndex = Math.max(firstBracket, firstSquareBracket);
  }

  if (startIndex !== -1) {
    const lastBracket = cleaned.lastIndexOf('}');
    const lastSquareBracket = cleaned.lastIndexOf(']');
    const endIndex = Math.max(lastBracket, lastSquareBracket);

    if (endIndex > startIndex) {
      cleaned = cleaned.substring(startIndex, endIndex + 1);
    }
  }

  cleaned = cleaned.replace(/[\u200B-\u200D\uFEFF]/g, '');
  cleaned = cleaned.replace(/\/\/[^\n]*\n?/g, '');
  cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');
  cleaned = cleaned.trim();

  if (cleaned.length !== originalLength && logger.isLevelEnabled('debug')) {
    logger.debug(
      'cleanJSONString: String was modified by cleaning heuristics.',
      {
        originalLength,
        cleanedLength: cleaned.length,
        originalPreview:
          input.substring(0, 100) + (input.length > 100 ? '...' : ''),
        cleanedPreview:
          cleaned.substring(0, 100) + (cleaned.length > 100 ? '...' : ''),
      }
    );
  }
  return cleaned;
}

/**
 * Recursively cleans all string values within a JSON-like object or array
 * using `cleanJSONString`.
 *
 * @public
 * @param {object|Array<any>} data - The object or array whose string values are to be cleaned.
 * @returns {object|Array<any>|string} A new data structure with cleaned string values.
 * @throws {DaitanInvalidInputError} if the input `data` is of an unsupported type.
 */
export function deepCleanJSON(data) {
  if (typeof data === 'string') {
    return cleanJSONString(data);
  } else if (Array.isArray(data)) {
    return data.map((item) => deepCleanJSON(item));
  } else if (data && typeof data === 'object') {
    const cleanedObject = {};
    for (const [key, value] of Object.entries(data)) {
      cleanedObject[key] = deepCleanJSON(value);
    }
    return cleanedObject;
  } else if (
    data === null ||
    typeof data === 'number' ||
    typeof data === 'boolean' ||
    data === undefined
  ) {
    return data;
  }

  logger.warn(
    `deepCleanJSON: Unsupported data type encountered: ${typeof data}. Returning as is.`
  );
  return data;
}

/**
 * Safely parses a JSON string. It can optionally attempt to clean the string
 * using `cleanJSONString` before parsing.
 *
 * @public
 * @param {string} jsonString - The JSON string to parse.
 * @param {object} [options={}] - Options for parsing.
 * @param {boolean} [options.attemptClean=true] - Whether to attempt cleaning the string.
 * @returns {any} The parsed JavaScript object or array.
 * @throws {DaitanInvalidInputError} If `jsonString` is not a string.
 * @throws {DaitanOperationError} If parsing fails.
 */
export function safeParseJSON(jsonString, options = {}) {
  const { attemptClean = true } = options;

  if (typeof jsonString !== 'string') {
    const errMsg = 'Input to safeParseJSON must be a string.';
    logger.error(errMsg, { inputType: typeof jsonString });
    throw new DaitanInvalidInputError(errMsg, { input: jsonString });
  }

  let stringToParse = attemptClean ? cleanJSONString(jsonString) : jsonString;

  try {
    return JSON.parse(stringToParse);
  } catch (error) {
    const detailedMessage = generateJSONErrorDetails(error, stringToParse);
    logger.error(
      `safeParseJSON: Failed to parse JSON string. ${detailedMessage}`
    );
    throw new DaitanOperationError(
      `JSON parsing failed: ${error.message}`,
      {
        inputStringPreview:
          stringToParse.substring(0, 200) +
          (stringToParse.length > 200 ? '...' : ''),
        attemptedClean,
      },
      error
    );
  }
}

/**
 * Validates if a string is valid JSON.
 * @public
 * @param {string} jsonString - The JSON string to validate.
 * @param {object} [options={}] - Options for validation.
 * @param {boolean} [options.attemptClean=true] - Whether to attempt cleaning before validating.
 * @returns {{ isValid: boolean, parsedJson?: any, error?: string }}
 *          An object indicating validity.
 */
export function validateJSON(jsonString, options = {}) {
  const { attemptClean = true } = options;
  if (typeof jsonString !== 'string') {
    return {
      isValid: false,
      parsedJson: null,
      error: 'Input must be a string to validate as JSON.',
    };
  }
  if (!jsonString.trim()) {
    return {
      isValid: false,
      parsedJson: null,
      error: 'Input JSON string is empty or contains only whitespace.',
    };
  }

  const stringToValidate = attemptClean
    ? cleanJSONString(jsonString)
    : jsonString;

  try {
    const parsed = JSON.parse(stringToValidate);
    return { isValid: true, parsedJson: parsed, error: null };
  } catch (e) {
    return {
      isValid: false,
      parsedJson: null,
      error: generateJSONErrorDetails(e, stringToValidate),
    };
  }
}

// intelligence/src/intelligence/metadata/parse.js

import { getLogger } from '@daitanjs/development';
const parseLogger = getLogger('daitan-metadata-parser');

/**
 * Validates and normalizes raw metadata output from an LLM.
 * Ensures essential fields (tags, type, summary) exist and have expected basic types.
 *
 * @param {any} rawLLMOutput - The raw output from the LLM, expected to be an object after JSON parsing.
 * @returns {{tags: string[], type: string, summary: string, originalRaw?: any}}
 *          A normalized metadata object. `originalRaw` is included if parsing/validation changes structure.
 */
export const validateAndNormalizeMetadata = (rawLLMOutput) => {
  const result = {
    tags: [],
    type: 'unknown',
    summary: 'No summary available.',
  };

  if (typeof rawLLMOutput !== 'object' || rawLLMOutput === null) {
    parseLogger.warn(
      'Raw LLM output for metadata is not an object or is null. Returning default structure.',
      { rawLLMOutput }
    );
    result.originalRaw = rawLLMOutput; // Store what was received if it's not an object
    return result;
  }

  // Tags: should be an array of strings.
  if (Array.isArray(rawLLMOutput.tags)) {
    result.tags = rawLLMOutput.tags
      .map((tag) => String(tag).trim().toLowerCase())
      .filter(Boolean);
  } else if (
    typeof rawLLMOutput.tags === 'string' &&
    rawLLMOutput.tags.trim()
  ) {
    // Handle case where LLM might return a comma-separated string for tags
    result.tags = rawLLMOutput.tags
      .split(',')
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean);
    parseLogger.debug('Converted string of tags to an array.', {
      originalTags: rawLLMOutput.tags,
      convertedTags: result.tags,
    });
  } else if (rawLLMOutput.tags) {
    parseLogger.warn(
      'Metadata "tags" field was present but not an array or valid string. Defaulting to empty array.',
      { tagsReceived: rawLLMOutput.tags }
    );
  }

  // Type: should be a string.
  if (typeof rawLLMOutput.type === 'string' && rawLLMOutput.type.trim()) {
    result.type = rawLLMOutput.type.trim().toLowerCase().replace(/\s+/g, '_'); // Normalize type string
  } else if (rawLLMOutput.type) {
    parseLogger.warn(
      'Metadata "type" field was present but not a string. Defaulting to "unknown".',
      { typeReceived: rawLLMOutput.type }
    );
  }

  // Summary: should be a string.
  if (typeof rawLLMOutput.summary === 'string' && rawLLMOutput.summary.trim()) {
    result.summary = rawLLMOutput.summary.trim();
  } else if (rawLLMOutput.summary) {
    parseLogger.warn(
      'Metadata "summary" field was present but not a string. Defaulting to "No summary available.".',
      { summaryReceived: rawLLMOutput.summary }
    );
  }

  // If the validated structure is different from raw (e.g. due to normalization or missing fields),
  // it might be useful to log or attach the original for debugging.
  // For simplicity here, we just return the normalized structure.
  // If rawLLMOutput itself was significantly different, one might add:
  // if (JSON.stringify(result) !== JSON.stringify(rawLLMOutput)) { // Basic check for structural difference
  //    result.originalRaw = rawLLMOutput;
  // }

  return result;
};

/**
 * @deprecated `tidyJsonString` is a simple heuristic and might not cover all cases.
 *             Prefer LLMs that reliably output valid JSON or use more robust JSON repair libraries if needed.
 *             `generateIntelligence` with `responseFormat: 'json'` should ideally handle JSON parsing robustly.
 * Simple attempt to clean common issues in LLM-generated JSON-like strings.
 * @param {string} str - The JSON-like string.
 * @returns {string} A potentially cleaner string.
 */
export const tidyJsonString = (str) => {
  if (typeof str !== 'string') return str;
  // This is a very basic attempt and might not be robust enough.
  // LLMs (like OpenAI with JSON mode) should ideally return valid JSON.
  return str
    .replace(/([{,]\s*)([A-Za-z0-9_]+)\s*:/g, '$1"$2":') // Add quotes to keys
    .replace(/[“”]/g, '"') // Replace smart quotes with standard quotes
    .replace(/'/g, '"') // Replace single quotes with double quotes (can be risky if content has apostrophes)
    .replace(/,\s*([}\]])/g, '$1') // Remove trailing commas before closing brace/bracket
    .replace(/\\'/g, "'") // Unescape apostrophes that might have been wrongly escaped if we replaced all single quotes
    .trim();
};

/**
 * Converts a value to a plain string, attempting to extract content if it's an object.
 * @param {any} value - The value to convert.
 * @returns {string} The string representation.
 */
export const toPlainString = (value) => {
  if (typeof value === 'string') return value;
  if (
    value &&
    typeof value === 'object' &&
    value.content &&
    typeof value.content === 'string'
  ) {
    return value.content; // Common pattern for LangChain message content
  }
  try {
    return JSON.stringify(value);
  } catch (e) {
    return String(value); // Fallback
  }
};

/**
 * @deprecated `generateIntelligence` with `responseFormat: 'json'` should directly return a parsed object.
 *             This function might be useful if dealing with LLM outputs that are strings needing parsing.
 * Safely parses a JSON string, attempting to clean it first.
 * @param {string | object} val - The value to parse. If already an object, returns it.
 * @returns {object} The parsed JSON object.
 * @throws {DaitanValidationError} If parsing fails.
 */
export const parseSafeJSON = (val) => {
  if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
    // Already a plain object
    return val;
  }
  if (typeof val !== 'string') {
    parseLogger.error('parseSafeJSON: Input is not a string or object.', {
      type: typeof val,
    });
    throw new DaitanValidationError(
      'Invalid input for JSON parsing: not a string or object.'
    );
  }

  try {
    // First, try direct parsing
    return JSON.parse(val);
  } catch (directParseError) {
    parseLogger.warn(
      'Direct JSON.parse failed, attempting to tidy and re-parse.',
      { error: directParseError.message, stringPreview: val.substring(0, 100) }
    );
    try {
      const tidiedString = tidyJsonString(val);
      return JSON.parse(tidiedString);
    } catch (tidyParseError) {
      parseLogger.error('JSON parsing failed even after tidying.', {
        originalError: directParseError.message,
        tidyError: tidyParseError.message,
        stringPreview: val.substring(0, 200),
      });
      throw new DaitanValidationError(
        `Failed to parse JSON string: ${tidyParseError.message}. Original error: ${directParseError.message}`,
        { stringAttempted: val }
      );
    }
  }
};

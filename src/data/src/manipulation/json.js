/**
 * Cleans up a string that is supposed to be a JSON string.
 * Ensures proper formatting for parsing.
 * @param {string} input - The JSON string to be cleaned.
 * @returns {string} Cleaned JSON string.
 */
function cleanJSONString(input) {
  return input
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width spaces
    .replace(/[^\x20-\x7E\u00C0-\u017F]/g, '') // Remove invalid characters
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/(\r\n|\n|\r)/gm, ' ') // Remove line breaks
    .replace(/\\+"/g, '\\"') // Handle escaped quotes
    .trim();
}

/**
 * Cleans JSON strings in an array of objects.
 * @param {Array} arr - Array of objects containing string values.
 * @returns {Array} Cleaned array of objects.
 */
const cleanArrayOfJSONStrings = (arr) =>
  arr.map((obj) =>
    Object.fromEntries(
      Object.entries(obj).map(([key, value]) => [
        key,
        typeof value === 'string' ? cleanJSONString(value) : value,
      ])
    )
  );

export {
  cleanJSONString,
  cleanArrayOfJSONStrings
};

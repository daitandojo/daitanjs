/**
 * Escapes special characters in a string for safe handling in text-based formats.
 *
 * @param {string} str - The string to escape.
 * @returns {string} The escaped string with special characters replaced.
 */
export const addEscapes = (str) => {
  return (
    str
      .replace(/[\\"']/g, "\\$&") // Escapes characters like ", \, and '
      .replace(/\u0000/g, "\\0")  // Escapes null bytes (Unicode U+0000)
      .replace(/\n/g, " ")        // Replaces newline characters with a space
  );
};


/**
 * Recursively escapes special characters in all string values within an object.
 *
 * @param {object} object - The object to process.
 * @returns {object} The same object with all string values escaped.
 */
export const escapeObject = (object) => {
  for (let key in object) {
    if (typeof object[key] === "object" && object[key] !== null) {
      escapeObject(object[key]); // Recursively process nested objects
    } else if (typeof object[key] === "string") {
      object[key] = addEscapes(object[key]); // Escape string values
    }
  }
  return object; // Return the modified object for consistency
};

// validation/src/index.js
/**
 * @file Main entry point for the @daitanjs/validation package.
 * @module @daitanjs/validation
 *
 * @description
 * This package provides a comprehensive set of validation functions for common data types
 * and formats encountered in web and Node.js development. It leverages utilities from
 * other DaitanJS packages where appropriate (e.g., `@daitanjs/manipulation` for JSON cleaning)
 * and integrates with `@daitanjs/development` for logging and `@daitanjs/error` for
 * consistent error reporting.
 *
 * Key Validation Areas:
 * - **JSON**: `isValidJSON` for validating and parsing JSON strings, with cleaning heuristics.
 * - **Contact Information**: `isEmail`, `isPhone` for common contact formats.
 * - **Strings**: `isName` (general purpose name validation), `isPassword` (configurable complexity),
 *   `isURL` (robust URL format check), `isIP` (IPv4 validation), `isCreditCard` (Luhn algorithm).
 * - **Date**: `isDate` for YYYY-MM-DD format validation.
 *
 * Each validation function is designed to be clear in its purpose and return boolean
 * results, while also logging details for debugging when appropriate. Invalid inputs to
 * validation functions themselves (e.g., passing a number to `isEmail`) will typically
 * result in `DaitanInvalidInputError`.
 */

import { getLogger } from '@daitanjs/development';
import {
  cleanJSONString as cleanJsonStringFromManipulation,
  safeParseJSON, // safeParseJSON is now robust and throws DaitanOperationError
} from '@daitanjs/manipulation';
import { DaitanInvalidInputError, DaitanOperationError } from '@daitanjs/error';

const logger = getLogger('daitan-validation');

/**
 * Generates detailed error messages for invalid JSON, including context from the string.
 * This helps pinpoint where parsing failed.
 * @private
 * @param {SyntaxError | Error} error - The JSON parsing error object.
 * @param {string} jsonString - The JSON string that caused the error.
 * @returns {{ isValid: false, parsedJson: null, error: string }} Validation result for an error.
 */
function generateJSONErrorDetails(error, jsonString) {
  const positionMatch = error.message.match(/position (\d+)/i); // Case insensitive for "position"
  let enhancedError = `JSON Error: ${error.message}`;

  if (positionMatch && positionMatch[1]) {
    const position = parseInt(positionMatch[1], 10);
    if (!isNaN(position)) {
      const contextChars = 25; // Show more context
      const start = Math.max(0, position - contextChars);
      const end = Math.min(jsonString.length, position + contextChars + 1); // +1 to include char at position
      let nearText = jsonString.substring(start, end);

      // Escape newlines in nearText for single-line log display
      nearText = nearText.replace(/\n/g, '\\n').replace(/\r/g, '\\r');

      const pointerOffset = position - start;
      const pointerLine = ' '.repeat(pointerOffset) + '^';

      enhancedError += `\n  Context around error (char ${position}): "${
        start > 0 ? '...' : ''
      }${nearText}${end < jsonString.length ? '...' : ''}"`;
      enhancedError += `\n  Approximate position:           ${
        start > 0 ? '   ' : ''
      }${pointerLine}`;
    }
  }

  // Add common hints
  if (
    jsonString.includes('“') ||
    jsonString.includes('”') ||
    jsonString.includes('‘') ||
    jsonString.includes('’')
  ) {
    enhancedError += `\n  Hint: Detected smart quotes (e.g., “ ” ‘ ’). JSON requires straight double quotes (" ").`;
  }
  if (jsonString.match(/,\s*([}\]])/g)) {
    // Trailing comma before } or ]
    enhancedError += `\n  Hint: Detected a trailing comma before a closing '}' or ']'. This is invalid in standard JSON.`;
  }
  if (jsonString.match(/(?<!\\)'/g)) {
    // Single quotes for strings (not preceded by a backslash)
    enhancedError += `\n  Hint: Detected single quotes used for strings. JSON string values must use double quotes (" ").`;
  }
  if (
    !jsonString.trim().startsWith('{') &&
    !jsonString.trim().startsWith('[')
  ) {
    enhancedError += `\n  Hint: Valid JSON text must be an object (starting with '{') or an array (starting with '[').`;
  }

  return { isValid: false, parsedJson: null, error: enhancedError };
}

/**
 * Checks if a given string is valid JSON.
 * It can optionally attempt to clean the string using heuristics from `@daitanjs/manipulation`
 * before parsing.
 *
 * @public
 * @param {string} jsonString - The JSON string to validate.
 * @param {object} [options={}] - Validation options.
 * @param {boolean} [options.attemptClean=true] - Whether to try cleaning the string first.
 * @returns {{ isValid: boolean, parsedJson?: any, error?: string }}
 *          An object indicating validity. If valid, `parsedJson` contains the parsed JavaScript object/array.
 *          If invalid, `error` contains a descriptive message including parsing context.
 */
export function isValidJSON(jsonString, options = {}) {
  const { attemptClean = true } = options; // Default to attempting clean, as it's often helpful

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
    ? cleanJsonStringFromManipulation(jsonString)
    : jsonString;
  if (
    attemptClean &&
    stringToValidate !== jsonString &&
    logger.isLevelEnabled('debug')
  ) {
    logger.debug(
      `isValidJSON: Original string (len ${jsonString.length}) was cleaned to (len ${stringToValidate.length}) before parsing attempt.`
    );
  }

  try {
    // safeParseJSON from @daitanjs/manipulation now uses cleanJSONString internally by default if attemptClean is true for it.
    // Here, we control cleaning *before* calling safeParseJSON.
    // If cleanJSONStringFromManipulation already applied, safeParseJSON's internal cleaning won't re-apply the same heuristics.
    const parsed = JSON.parse(stringToValidate); // Direct parse after our cleaning
    return { isValid: true, parsedJson: parsed, error: null };
  } catch (e) {
    // e is SyntaxError from JSON.parse
    return generateJSONErrorDetails(e, stringToValidate);
  }
}

/**
 * Validates if a string is a syntactically valid URL.
 * @public
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
 * Validates an email address using a common regular expression.
 *
 * @public
 * @param {string} email - The email address string to validate.
 * @returns {boolean} True if the email format appears valid, false otherwise.
 *          Returns false if `email` is not a string.
 */
export function isEmail(email) {
  if (typeof email !== 'string') {
    logger.debug(
      `isEmail: Input is not a string (type: ${typeof email}). Returning false.`
    );
    return false;
  }
  // A widely accepted "good enough" regex for email validation. RFC 5322 is very complex.
  // Allows most common email formats, including newer TLDs.
  const emailRegex =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  const trimmedEmail = email.trim();
  if (trimmedEmail.length > 254) {
    // Practical limit for email address length
    logger.debug(
      `isEmail: Email "${trimmedEmail.substring(
        0,
        30
      )}..." exceeds max length (254). Returning false.`
    );
    return false;
  }
  const isValid = emailRegex.test(trimmedEmail);
  logger.debug(`isEmail: Validation for "${trimmedEmail}": ${isValid}`);
  return isValid;
}

/**
 * Validates a phone number string.
 * This is a basic check for common phone number patterns, not a strict E.164 validator.
 * It allows an optional leading '+', digits, and common separators like spaces, hyphens, parentheses.
 * Checks for a minimum of 7 digits after cleaning separators.
 *
 * @public
 * @param {string} phoneNumber - The phone number string to validate.
 * @returns {boolean} True if the phone number format is potentially valid, false otherwise.
 *          Returns false if `phoneNumber` is not a string.
 */
export function isPhone(phoneNumber) {
  if (typeof phoneNumber !== 'string') {
    logger.debug(
      `isPhone: Input is not a string (type: ${typeof phoneNumber}). Returning false.`
    );
    return false;
  }
  // Allows for: optional '+', digits, spaces, hyphens, parentheses. Total length 7 to 20 characters.
  const phoneRegex = /^\+?[0-9\s\-().]{7,20}$/;
  const trimmedPhoneNumber = phoneNumber.trim();
  if (!phoneRegex.test(trimmedPhoneNumber)) {
    logger.debug(
      `isPhone: Phone number "${trimmedPhoneNumber}" fails regex format check.`
    );
    return false;
  }
  // Count actual digits after removing '+' and separators
  const digitsOnly = trimmedPhoneNumber.replace(/[^\d]/g, ''); // Remove all non-digits
  const minDigits = 7;
  const maxDigits = 15; // E.164 max
  if (digitsOnly.length < minDigits || digitsOnly.length > maxDigits) {
    logger.debug(
      `isPhone: Phone number "${trimmedPhoneNumber}" has ${digitsOnly.length} digits, expected ${minDigits}-${maxDigits}.`
    );
    return false;
  }
  logger.debug(`isPhone: Validation for "${trimmedPhoneNumber}": Passed.`);
  return true;
}

/**
 * Validates a name string (e.g., for persons, places, things).
 * Checks for min/max length and optionally against a regex for allowed characters.
 *
 * @public
 * @param {string} name - The name string to validate.
 * @param {object} [options] - Optional configuration for validation.
 * @param {number} [options.minLength=2] - Minimum allowed length for the trimmed name.
 * @param {number} [options.maxLength=100] - Maximum allowed length for the trimmed name.
 * @param {RegExp} [options.allowedCharsRegex] - Optional regular expression to test against the trimmed name.
 *        If provided, the name must match this regex.
 * @returns {boolean} True if the name is valid according to the criteria, false otherwise.
 *          Returns false if `name` is not a string.
 */
export function isName(
  name,
  { minLength = 2, maxLength = 100, allowedCharsRegex } = {}
) {
  if (typeof name !== 'string') {
    logger.debug(
      `isName: Input is not a string (type: ${typeof name}). Returning false.`
    );
    return false;
  }
  const trimmedName = name.trim();
  if (trimmedName.length < minLength || trimmedName.length > maxLength) {
    logger.debug(
      `isName: Validation failed for "${trimmedName}": Length (${trimmedName.length}) out of range [${minLength}-${maxLength}].`
    );
    return false;
  }
  if (
    allowedCharsRegex instanceof RegExp &&
    !allowedCharsRegex.test(trimmedName)
  ) {
    logger.debug(
      `isName: Validation failed for "${trimmedName}": Contains disallowed characters based on regex: ${allowedCharsRegex.source}`
    );
    return false;
  }
  logger.debug(`isName: Validation for "${trimmedName}": Passed.`);
  return true;
}

/**
 * Validates a password based on configurable complexity requirements.
 *
 * @public
 * @param {string} password - The password string to validate.
 * @param {object} [options] - Configuration options for password complexity.
 * @param {number} [options.minLength=8] - Minimum length of the password.
 * @param {boolean} [options.requireUppercase=true] - Whether an uppercase letter is required.
 * @param {boolean} [options.requireLowercase=true] - Whether a lowercase letter is required.
 * @param {boolean} [options.requireNumber=true] - Renamed from `requireNumbers` for consistency. Whether a digit is required.
 * @param {boolean} [options.requireSpecialChar=true] - Renamed from `requireSpecialChars`. Whether a special character is required.
 * @param {RegExp} [options.specialCharRegex=/[!@#$%^&*(),.?":{}|<>~`_+\-=[\]\\';/]/] - Regex defining allowed special characters.
 *                                                                           Added `~`, `` ` ``, `_`, `+`, `-`, `=`, `[`, `]`, `\`, `'`, `;`, `/`.
 * @returns {boolean} True if the password meets all specified criteria, false otherwise.
 *          Returns false if `password` is not a string.
 */
export function isPassword(
  password,
  {
    minLength = 8,
    requireUppercase = true,
    requireLowercase = true,
    requireNumber = true, // Renamed
    requireSpecialChar = true, // Renamed
    specialCharRegex = /[!@#$%^&*(),.?":{}|<>~`_+\-=[\]\\';/]/, // Expanded default set
  } = {}
) {
  if (typeof password !== 'string') {
    logger.debug(`isPassword: Input is not a string. Returning false.`);
    return false;
  }

  const checks = [];
  const failureReasons = [];

  if (password.length < minLength) {
    failureReasons.push(
      `minLength of ${minLength} (actual: ${password.length})`
    );
    checks.push(false);
  } else {
    checks.push(true);
  }

  if (requireUppercase && !/[A-Z]/.test(password)) {
    failureReasons.push('requireUppercase');
    checks.push(false);
  } else {
    checks.push(true);
  }

  if (requireLowercase && !/[a-z]/.test(password)) {
    failureReasons.push('requireLowercase');
    checks.push(false);
  } else {
    checks.push(true);
  }

  if (requireNumber && !/\d/.test(password)) {
    failureReasons.push('requireNumber');
    checks.push(false);
  } else {
    checks.push(true);
  }

  if (requireSpecialChar && !specialCharRegex.test(password)) {
    failureReasons.push(
      `requireSpecialChar (pattern: ${specialCharRegex.source})`
    );
    checks.push(false);
  } else {
    checks.push(true);
  }

  const isValid = checks.every(Boolean);
  if (!isValid) {
    logger.debug(
      `Password validation failed. Criteria not met: ${failureReasons.join(
        '; '
      )}.`
    );
  } else {
    logger.debug('Password validation passed.');
  }
  return isValid;
}

/**
 * Validates if a string is a syntactically valid URL.
 * This uses the canonical `isValidURL` from `@daitanjs/utilities`.
 *
 * @public
 * @param {string} urlString - The URL string to validate.
 * @returns {boolean} True if `urlString` is a valid URL format, false otherwise.
 */
export function isURL(urlString) {
  // Delegate to the canonical utility for DRY principle
  const isValid = isValidURLFromUtilities(urlString);
  logger.debug(
    `isURL (via @daitanjs/utilities): Validation for "${urlString}": ${isValid}`
  );
  return isValid;
}

/**
 * Validates a date string, specifically checking for YYYY-MM-DD format and calendar validity.
 *
 * @public
 * @param {string} dateString - The date string to validate (e.g., "2023-12-31").
 * @returns {boolean} True if `dateString` is a valid YYYY-MM-DD date, false otherwise.
 *          Returns false if `dateString` is not a string.
 */
export function isDate(dateString) {
  if (typeof dateString !== 'string') {
    logger.debug(
      `isDate: Input is not a string (type: ${typeof dateString}). Returning false.`
    );
    return false;
  }
  const trimmedDateString = dateString.trim();
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/; // Strictly YYYY-MM-DD

  if (!dateRegex.test(trimmedDateString)) {
    logger.debug(
      `isDate: Date string "${trimmedDateString}" does not match YYYY-MM-DD format.`
    );
    return false;
  }

  const [year, month, day] = trimmedDateString.split('-').map(Number);

  // Use Date object to check for calendar validity (e.g., day exists in month, leap year for Feb 29)
  // Important: JavaScript months are 0-indexed (January is 0, December is 11).
  const dateObj = new Date(year, month - 1, day);

  const isValid =
    !isNaN(dateObj.getTime()) && // Check if date is valid at all
    dateObj.getFullYear() === year &&
    dateObj.getMonth() === month - 1 &&
    dateObj.getDate() === day;

  logger.debug(`isDate: Validation for "${trimmedDateString}": ${isValid}`);
  return isValid;
}

/**
 * Validates an IPv4 address string.
 *
 * @public
 * @param {string} ip - The IP address string to validate.
 * @returns {boolean} True if `ip` is a valid IPv4 address format, false otherwise.
 *          Returns false if `ip` is not a string.
 */
export function isIP(ip) {
  if (typeof ip !== 'string') {
    logger.debug(
      `isIP: Input is not a string (type: ${typeof ip}). Returning false.`
    );
    return false;
  }
  // Regex for IPv4: four octets (0-255) separated by dots.
  const ipv4Regex =
    /^(?:(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])\.){3}(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])$/;
  const isValid = ipv4Regex.test(ip.trim());
  logger.debug(`isIP (IPv4 check): Validation for "${ip.trim()}": ${isValid}`);
  // Note: This does not validate IPv6. For IPv6, a more complex regex or dedicated library is needed.
  return isValid;
}

/**
 * Validates a credit card number string using the Luhn algorithm (mod 10 check).
 * This checks for basic checksum validity, not whether the card is active or exists.
 * Accepts card numbers of common lengths (13-19 digits) after stripping non-digits.
 *
 * @public
 * @param {string} cardNumber - The credit card number string to validate.
 * @returns {boolean} True if the card number passes the Luhn checksum and length checks, false otherwise.
 *          Returns false if `cardNumber` is not a string.
 */
export function isCreditCard(cardNumber) {
  if (typeof cardNumber !== 'string') {
    logger.debug(
      `isCreditCard: Input is not a string (type: ${typeof cardNumber}). Returning false.`
    );
    return false;
  }
  const cleanedCardNumber = cardNumber.replace(/\D/g, ''); // Remove all non-digit characters

  // Check length (common Visa, Mastercard, Amex, Discover lengths range from 13 to 19)
  if (!/^\d{13,19}$/.test(cleanedCardNumber)) {
    logger.debug(
      `isCreditCard: Cleaned card number "${cleanedCardNumber}" fails length check (13-19 digits). Original: "${cardNumber}"`
    );
    return false;
  }

  // Luhn Algorithm
  let sum = 0;
  let shouldDouble = false;
  for (let i = cleanedCardNumber.length - 1; i >= 0; i--) {
    let digit = parseInt(cleanedCardNumber.charAt(i), 10);

    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  const isValid = sum % 10 === 0;
  logger.debug(
    `isCreditCard: Luhn check for "${cleanedCardNumber}" (cleaned from "${cardNumber}"): ${isValid}`
  );
  return isValid;
}

// The local `isValidUrlLocal` was removed as `isURL` now correctly delegates to `@daitanjs/utilities`.

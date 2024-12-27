/**
 * @module Validation
 * @description A comprehensive set of validation functions for common data types and formats.
 */

import { cleanJSONString } from '../manipulation';

function isValidJSON(jsonString) {
  const cleanedString = cleanJSONString(jsonString);

  try {
    const parsed = JSON.parse(cleanedString);
    return { isValid: true, json: parsed, error: null };
  } catch (e) {
    const positionMatch = e.message.match(/position (\d+)/);
    let enhancedError = `Error: ${e.message}`;

    if (positionMatch) {
      const position = parseInt(positionMatch[1], 10);
      const start = Math.max(0, position - 20);
      const end = Math.min(cleanedString.length, position + 20);
      const nearText = cleanedString.slice(start, end);

      enhancedError += `\nNear: "...${nearText}..."\n${' '.repeat(position - start + 3)}^`;
      enhancedError += jsonString.includes('“') || jsonString.includes('”')
        ? '\nHint: Detected smart quotes. Replace with straight quotes.'
        : '';
    }

    return { isValid: false, json: null, error: enhancedError };
  }
}

/**
 * Validates an email address.
 * @param {string} email - The email address to validate.
 * @returns {boolean} True if the email is valid, false otherwise.
 */
function isEmail(email) {
  const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(String(email).toLowerCase());
}

/**
 * Validates a phone number.
 * @param {string} phoneNumber - The phone number to validate.
 * @returns {boolean} True if the phone number is valid, false otherwise.
 */
function isPhone(phoneNumber) {
  if (!phoneNumber) return false;
  const cleanedNumber = phoneNumber.replace(/\s+/g, '');
  return /^\+\d{10,15}$/.test(cleanedNumber);
}

/**
 * Validates a name.
 * @param {string} name - The name to validate.
 * @param {Object} [options] - Optional configuration.
 * @param {number} [options.minLength=2] - Minimum allowed length.
 * @param {number} [options.maxLength=50] - Maximum allowed length.
 * @returns {boolean} True if the name is valid, false otherwise.
 */
function isName(name, { minLength = 2, maxLength = 50 } = {}) {
  if (typeof name !== 'string') return false;
  const trimmedName = name.trim();
  return trimmedName.length >= minLength && trimmedName.length <= maxLength && /^[a-zA-Z\s'-\u00C0-\u017F]+$/.test(trimmedName);
}

/**
 * Validates a password.
 * @param {string} password - The password to validate.
 * @param {Object} [options] - Optional configuration.
 * @param {number} [options.minLength=8] - Minimum allowed length.
 * @param {boolean} [options.requireUppercase=true] - Require at least one uppercase letter.
 * @param {boolean} [options.requireLowercase=true] - Require at least one lowercase letter.
 * @param {boolean} [options.requireNumbers=true] - Require at least one number.
 * @param {boolean} [options.requireSpecialChars=true] - Require at least one special character.
 * @returns {boolean} True if the password is valid, false otherwise.
 */
function isPassword(password, {
  minLength = 8,
  requireUppercase = true,
  requireLowercase = true,
  requireNumbers = true,
  requireSpecialChars = true
} = {}) {
  if (typeof password !== 'string' || password.length < minLength) return false;

  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChars = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  return (!requireUppercase || hasUppercase) &&
         (!requireLowercase || hasLowercase) &&
         (!requireNumbers || hasNumbers) &&
         (!requireSpecialChars || hasSpecialChars);
}

/**
 * Validates a URL.
 * @param {string} url - The URL to validate.
 * @param {Object} [options] - Optional configuration.
 * @param {boolean} [options.requireProtocol=true] - Require protocol (http:// or https://) in the URL.
 * @returns {boolean} True if the URL is valid, false otherwise.
 */
function isURL(url, { requireProtocol = true } = {}) {
  if (typeof url !== 'string') return false;

  const protocolRegex = requireProtocol ? '^(https?:\/\/)?' : '^';
  const urlRegex = new RegExp(protocolRegex + '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' +
                               '((\\d{1,3}\\.){3}\\d{1,3}))' +
                               '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' +
                               '(\\?[;&a-z\\d%_.~+=-]*)?' +
                               '(\\#[-a-z\\d_]*)?$', 'i');
  return urlRegex.test(url);
}

/**
 * Validates a date string.
 * @param {string} dateString - The date string to validate.
 * @param {string} [format='YYYY-MM-DD'] - The expected date format.
 * @returns {boolean} True if the date string is valid, false otherwise.
 */
function isDate(dateString, format = 'YYYY-MM-DD') {
  if (typeof dateString !== 'string') return false;

  const formatRegex = {
    'YYYY-MM-DD': /^\d{4}-\d{2}-\d{2}$/,
    'MM/DD/YYYY': /^\d{2}\/\d{2}\/\d{4}$/,
    'DD.MM.YYYY': /^\d{2}\.\d{2}\.\d{4}$/
  };

  if (!formatRegex[format].test(dateString)) return false;

  const parts = dateString.split(/[-/.]/);
  const [year, month, day] = format === 'YYYY-MM-DD' ? parts : parts.reverse();

  const isoDate = new Date(year, month - 1, day);
  return isoDate.getFullYear() == year && isoDate.getMonth() + 1 == month && isoDate.getDate() == day;
}

/**
 * Validates an IP address (IPv4 or IPv6).
 * @param {string} ip - The IP address to validate.
 * @returns {boolean} True if the IP address is valid, false otherwise.
 */
function isIP(ip) {
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;

  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}

/**
 * Validates a credit card number using the Luhn algorithm.
 * @param {string} cardNumber - The credit card number to validate.
 * @returns {boolean} True if the credit card number is valid, false otherwise.
 */
function isCreditCard(cardNumber) {
  if (typeof cardNumber !== 'string') return false;

  const cleanedNumber = cardNumber.replace(/\D/g, '');
  if (cleanedNumber.length < 13 || cleanedNumber.length > 19) return false;

  let sum = 0;
  let isEven = false;

  for (let i = cleanedNumber.length - 1; i >= 0; i--) {
    let digit = parseInt(cleanedNumber.charAt(i), 10);

    if (isEven) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }

    sum += digit;
    isEven = !isEven;
  }

  return sum % 10 === 0;
}

export {
  isValidJSON,
  isEmail,
  isPhone,
  isName,
  isPassword,
  isURL,
  isDate,
  isIP,
  isCreditCard
};

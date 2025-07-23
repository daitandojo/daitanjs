// html/src/styles.js
/**
 * @file Internal utilities for handling HTML styles and attributes.
 * @module @daitanjs/html/styles
 * @private
 */
import { getLogger } from '@daitanjs/development';

const stylesLogger = getLogger('daitan-html-styles');

/**
 * Merges a default style string with a custom style object.
 * @param {string} defaultStylesString - The base CSS string.
 * @param {object} [customStylesObject={}] - An object of CSS properties to merge/override.
 * @returns {string} The final, combined CSS string.
 */
export const mergeStyles = (
  defaultStylesString,
  customStylesObject = {}
) => {
  let finalStyles = defaultStylesString
    ? String(defaultStylesString).trim()
    : '';
  if (finalStyles && !finalStyles.endsWith(';')) {
    finalStyles += ';';
  }
  if (customStylesObject && typeof customStylesObject === 'object') {
    for (const [key, value] of Object.entries(customStylesObject)) {
      const cssKey = key.replace(
        /[A-Z]/g,
        (match) => `-${match.toLowerCase()}`
      );
      if (
        value !== undefined &&
        value !== null &&
        String(value).trim() !== ''
      ) {
        const stringValue = String(value);
        if (
          stringValue.includes('<script') ||
          stringValue.includes('javascript:') ||
          stringValue.includes('url(')
        ) {
          stylesLogger.warn(
            `mergeStyles: Potentially unsafe value for CSS property "${cssKey}"... Skipping.`
          );
          continue;
        }
        finalStyles += `${cssKey}:${stringValue};`;
      }
    }
  }
  return finalStyles.trim();
};

/**
 * Builds an HTML attribute string from an object.
 * @param {object} [attrs={}] - An object of attributes.
 * @returns {string} The formatted attribute string.
 */
export const buildAttributes = (attrs = {}) => {
  let attrString = '';
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'style' && typeof value === 'object' && value !== null) {
      attrString += ` style="${mergeStyles('', value)}"`;
    } else if (value !== undefined && value !== null && value !== false) {
      const escapedValue = String(value)
        .replace(/&/g, '&')
        .replace(/</g, '<')
        .replace(/>/g, '>')
        .replace(/"/g, '"')
        .replace(/'/g, `'`);
      attrString += ` ${key}="${escapedValue}"`;
    }
  }
  return attrString;
};
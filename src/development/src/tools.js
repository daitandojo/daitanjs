// development/src/tools.js
/**
 * @file General developer utility tools.
 * @module @daitanjs/development/tools
 *
 * @description
 * This module provides simple utility functions that can be helpful during development
 * and debugging, such as conditional logging. It is distinct from the main
 * `@daitanjs/utilities` package, which contains more general-purpose, production-ready utilities.
 * Tools in this module might be more focused on the development lifecycle.
 *
 * The `safeExecute` function, previously in an older version of this file or in
 * `manipulation/src/strings.js` (as `multitest`), has its canonical and more robust
 * implementation in `@daitanjs/utilities`. This module should not duplicate it.
 */
import { getLogger } from './logger.js'; // Using the logger from the same package

const devToolsLogger = getLogger('daitan-dev-tools');

/**
 * A simple conditional console logging utility, primarily for development-time debugging.
 * It allows quick logging to the console based on a condition, using specified console methods.
 * For structured application logging, always prefer the Winston-based logger obtained via `getLogger`.
 *
 * @public
 * @param {any} content - The content to log to the console. Can be any type.
 * @param {boolean} [condition=true] - If true, the `content` will be logged.
 * @param {'log'|'warn'|'error'|'info'|'debug'|'table'|'dir'} [consoleMethod='log'] -
 *        The `console` method to use for logging (e.g., `console.log`, `console.warn`).
 *        Defaults to `console.log`.
 * @param {string} [logPrefix='[DaitanDevLog]'] - A prefix string for the console output.
 *
 * @example
 * devSimpleLog("User object:", true, "dir", { id: 1, name: "Test" });
 * devSimpleLog("An important warning", someCondition, "warn");
 */
export const devSimpleLog = (
  content,
  condition = true,
  consoleMethod = 'log',
  logPrefix = '[DaitanDevLog]'
) => {
  if (condition) {
    const validMethods = [
      'log',
      'warn',
      'error',
      'info',
      'debug',
      'table',
      'dir',
    ];
    const methodToUse = validMethods.includes(consoleMethod)
      ? consoleMethod
      : 'log';

    if (typeof console[methodToUse] === 'function') {
      console[methodToUse](logPrefix, content);
    } else {
      // Fallback if an invalid method name was somehow passed and not caught by validMethods
      console.log(logPrefix, content);
    }
  }
};

/**
 * @deprecated `devMultitestExample` is a placeholder from an older iteration and serves no
 * specific utility purpose. It was moved here from `manipulation/src/strings.js` (where it was `multitest`)
 * as an example of a development-specific tool/test function.
 * It should ideally be removed or replaced with a meaningful development utility.
 *
 * @returns {number} Always returns the number 4.
 */
export const devMultitestExample = () => {
  devToolsLogger.info(
    'devMultitestExample (deprecated placeholder) called. Returning 4.'
  );
  return 4;
};

// Note on `safeExecute`:
// The `safeExecute` utility, which provides a try-catch wrapper for asynchronous functions,
// has its canonical and more robust implementation in the `@daitanjs/utilities` package.
// If tools or utilities within the `@daitanjs/development` package itself needed such
// functionality, they should import it from `@daitanjs/utilities` to maintain DRY principles.
// This `tools.js` file is intended for utilities specific to the development process itself or
// those that are too simple or dev-focused to belong in the main `@daitanjs/utilities`.

devToolsLogger.debug('DaitanJS Development Tools module loaded.');

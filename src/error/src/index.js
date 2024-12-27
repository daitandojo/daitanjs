/**
 * @module ErrorHandler
 * @description A centralized error handling module for catching, logging, and reporting errors.
 */


export async function safeExecute(fn, onError) {
  try {
    return await fn();
  } catch (error) {
    onError?.(error);
    return null;
  }
}

/**
 * Custom error class for application-specific errors.
 */
class AppError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Logs the error to console and optionally to a file.
 * @param {Error} error - The error to log.
 * @param {Object} context - Additional context about the error.
 */
function logError(error, context = {}) {
  console.error('Error:', error.message);
  console.error('Stack:', error.stack);
  console.error('Context:', JSON.stringify(context, null, 2));
  // Here you could also log to a file or external logging service
}

// /**
//  * Reports the error to a centralized error tracking service.
//  * @param {Error} error - The error to report.
//  * @param {Object} context - Additional context about the error.
//  */
// async function reportError(error, context = {}) {
//   try {
//     await sendErrorReport({
//       message: error.message,
//       stack: error.stack,
//       code: error.code,
//       details: error.details,
//       context
//     });
//   } catch (reportingError) {
//     console.error('Error reporting failed:', reportingError);
//   }
// }

/**
 * Handles an error by logging it and optionally reporting it.
 * @param {Error} error - The error to handle.
 * @param {Object} options - Options for error handling.
 * @param {Object} options.context - Additional context about the error.
 * @param {boolean} options.shouldReport - Whether to report the error.
 */
function handleError(error, { context = {}, shouldReport = true } = {}) {
  logError(error, context);
  if (shouldReport) {
    reportError(error, context);
  }
}

/**
 * Creates an error handler for async functions.
 * @param {Function} fn - The async function to wrap with error handling.
 * @returns {Function} A new function with error handling.
 */
function createAsyncErrorHandler(fn) {
  return async function (...args) {
    try {
      return await fn(...args);
    } catch (error) {
      handleError(error, { context: { functionName: fn.name, arguments: args } });
      throw error; // Re-throw the error after handling
    }
  };
}

export {
  AppError,
  handleError,
  createAsyncErrorHandler
};
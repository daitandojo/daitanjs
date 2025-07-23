// error/src/index.js
/**
 * @file Defines custom DaitanJS error classes.
 * @module @daitanjs/error
 *
 * @description
 * This package provides a hierarchy of custom error classes extending the base JavaScript `Error`.
 * These custom errors allow for more specific error identification and handling throughout
 * the DaitanJS ecosystem. They contain no complex logic and have no internal DaitanJS dependencies,
 * making them a foundational, pure building block. Logging of these errors is handled by consumers.
 */

/**
 * @class DaitanError
 * @extends Error
 * @description Base DaitanJS Error class. All other DaitanJS errors extend this class.
 *
 * @param {string} message - The human-readable error message.
 * @param {string} code - A machine-readable error code (e.g., 'CONFIGURATION_ERROR').
 * @param {object} [details={}] - Optional: An object containing additional context.
 * @param {Error} [originalError] - Optional: The original error if this DaitanError is wrapping another.
 */
export class DaitanError extends Error {
  constructor(message, code, details = {}, originalError) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = { ...details };
    this.timestamp = new Date().toISOString();
    this.originalError = originalError;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    } else {
      this.stack = new Error(message).stack;
    }
  }

  /**
   * Converts the error instance to a plain JavaScript object for serialization (e.g., in API responses).
   * @returns {object} A plain object representation of the error.
   */
  toPlainObject() {
    const plain = {
      name: this.name,
      message: this.message,
      code: this.code,
      timestamp: this.timestamp,
      details: this.details || {},
    };
    if (this.stack) {
      plain.stackPreview =
        this.stack.substring(0, 400) + (this.stack.length > 400 ? '...' : '');
    }

    if (this.originalError && this.originalError instanceof Error) {
      plain.originalError = {
        name: this.originalError.name,
        message: this.originalError.message,
        stackPreview: this.originalError.stack
          ? this.originalError.stack.substring(0, 300) +
            (this.originalError.stack.length > 300 ? '...' : '')
          : undefined,
      };
    } else if (this.originalError) {
      plain.originalError = { message: String(this.originalError) };
    }
    return plain;
  }
}

// --- Specific DaitanError Subclasses ---

/**
 * @class DaitanConfigurationError
 * @extends DaitanError
 * @description For errors related to application configuration, such as missing environment variables or invalid setup.
 * @example
 * throw new DaitanConfigurationError('API Key for "Stripe" is not set.', { service: 'Stripe' });
 */
export class DaitanConfigurationError extends DaitanError {
  constructor(message, details = {}, originalError) {
    super(message, 'CONFIGURATION_ERROR', details, originalError);
  }
}

/**
 * @class DaitanInvalidInputError
 * @extends DaitanError
 * @description For errors caused by invalid input parameters passed to a function or API.
 * @example
 * if (typeof userId !== 'string') {
 *   throw new DaitanInvalidInputError('User ID must be a string.', { parameter: 'userId', typeReceived: typeof userId });
 * }
 */
export class DaitanInvalidInputError extends DaitanError {
  constructor(message, details = {}, originalError) {
    super(message, 'INVALID_INPUT', details, originalError);
  }
}

/**
 * @class DaitanValidationError
 * @extends DaitanError
 * @description For errors related to data failing validation against a schema or business rules.
 * @example
 * const issues = [{ path: 'email', message: 'Must be a valid email address.' }];
 * throw new DaitanValidationError('User data validation failed.', { issues });
 */
export class DaitanValidationError extends DaitanError {
  constructor(message, details = {}, originalError) {
    super(message, 'VALIDATION_ERROR', details, originalError);
  }
}

/**
 * @class DaitanApiError
 * @extends DaitanError
 * @description For errors originating from an external API call (e.g., HTTP 4xx/5xx responses).
 * @example
 * throw new DaitanApiError('Stripe API call failed.', { apiName: 'Stripe', httpStatusCode: 402, apiErrorCode: 'card_declined' });
 */
export class DaitanApiError extends DaitanError {
  constructor(message, details = {}, originalError) {
    super(message, 'API_ERROR', details, originalError);
    if (details.httpStatusCode) {
      this.httpStatusCode = details.httpStatusCode;
    }
  }
}

/**
 * @class DaitanDatabaseError
 * @extends DaitanError
 * @description For errors related to database operations (e.g., connection failed, query error).
 * @example
 * throw new DaitanDatabaseError('Failed to connect to MongoDB.', { host: 'mongo.example.com' }, originalMongoError);
 */
export class DaitanDatabaseError extends DaitanError {
  constructor(message, details = {}, originalError) {
    super(message, 'DATABASE_ERROR', details, originalError);
  }
}

/**
 * @class DaitanNotFoundError
 * @extends DaitanError
 * @description For when a requested resource (e.g., a user, a file) could not be found.
 * @example
 * throw new DaitanNotFoundError('User with ID 123 not found.', { resourceType: 'User', resourceId: 123 });
 */
export class DaitanNotFoundError extends DaitanError {
  constructor(message = 'Resource not found.', details = {}, originalError) {
    super(message, 'NOT_FOUND', details, originalError);
  }
}

/**
 * @class DaitanAuthenticationError
 * @extends DaitanError
 * @description For errors related to user authentication (e.g., invalid credentials, expired token).
 * @example
 * throw new DaitanAuthenticationError('Invalid password.', { userId: 'user-123', attemptSource: 'login_form' });
 */
export class DaitanAuthenticationError extends DaitanError {
  constructor(message = 'Authentication failed.', details = {}, originalError) {
    super(message, 'AUTHENTICATION_ERROR', details, originalError);
  }
}

/**
 * @class DaitanAuthorizationError
 * @extends DaitanError
 * @description For errors where an authenticated user does not have permission to perform an action.
 * @example
 * throw new DaitanAuthorizationError('User does not have "admin" role.', { userId: 'user-123', requiredRole: 'admin' });
 */
export class DaitanAuthorizationError extends DaitanError {
  constructor(
    message = 'Authorization denied. Access forbidden.',
    details = {},
    originalError
  ) {
    super(message, 'AUTHORIZATION_ERROR', details, originalError);
  }
}

/**
 * @class DaitanPaymentError
 * @extends DaitanApiError
 * @description For payment-specific errors from a payment gateway API.
 * @example
 * throw new DaitanPaymentError('Card has been declined.', { apiName: 'Stripe', gatewayErrorCode: 'card_declined' });
 */
export class DaitanPaymentError extends DaitanApiError {
  constructor(message, details = {}, originalError) {
    // A payment error is a specific type of API error.
    super(message, details, originalError);
    this.name = 'DaitanPaymentError';
  }
}

/**
 * @class DaitanFileOperationError
 * @extends DaitanError
 * @description For errors related to file system operations (read, write, delete).
 * @example
 * throw new DaitanFileOperationError('Failed to write to file.', { path: '/tmp/data.log', operation: 'write' }, originalFsError);
 */
export class DaitanFileOperationError extends DaitanError {
  constructor(message, details = {}, originalError) {
    super(message, 'FILE_OPERATION_ERROR', details, originalError);
  }
}

/**
 * @class DaitanNetworkError
 * @extends DaitanError
 * @description For errors related to network connectivity (e.g., DNS lookup failed, connection timed out).
 * @example
 * throw new DaitanNetworkError('Connection timed out to example.com.', { host: 'example.com', timeout: 5000 });
 */
export class DaitanNetworkError extends DaitanError {
  constructor(message, details = {}, originalError) {
    super(message, 'NETWORK_ERROR', details, originalError);
  }
}

/**
 * @class DaitanOperationError
 * @extends DaitanError
 * @description A general-purpose error for a failed operation that doesn't fit a more specific category.
 * @example
 * throw new DaitanOperationError('PDF generation failed.', { library: 'pdf-lib' });
 */
export class DaitanOperationError extends DaitanError {
  constructor(message, details = {}, originalError) {
    super(message, 'OPERATION_FAILED', details, originalError);
  }
}

/**
 * @class DaitanExternalDependencyError
 * @extends DaitanError
 * @description For when an external dependency (like a command-line tool or library) fails.
 * @example
 * throw new DaitanExternalDependencyError('Puppeteer failed to launch.', { dependency: 'Puppeteer' });
 */
export class DaitanExternalDependencyError extends DaitanError {
  constructor(message, details = {}, originalError) {
    super(message, 'EXTERNAL_DEPENDENCY_ERROR', details, originalError);
  }
}

/**
 * @class DaitanBrowserSpecificError
 * @extends DaitanOperationError
 * @description For when code intended for one environment (e.g., Node.js) is run in another (e.g., browser).
 * @example
 * throw new DaitanBrowserSpecificError('File system access is not available in the browser.');
 */
export class DaitanBrowserSpecificError extends DaitanOperationError {
  constructor(message, details = {}, originalError) {
    super(message, 'ENVIRONMENT_MISMATCH_ERROR', details, originalError);
    this.name = 'DaitanBrowserSpecificError';
  }
}

/**
 * @class DaitanScrapingError
 * @extends DaitanOperationError
 * @description Error specific to web scraping operations.
 * @example
 * throw new DaitanScrapingError('Failed to find selector ".content".', { url: 'http://example.com' });
 */
export class DaitanScrapingError extends DaitanOperationError {
  constructor(message, details = {}, originalError) {
    super(message, 'SCRAPING_ERROR', details, originalError);
    this.name = 'DaitanScrapingError';
  }
}

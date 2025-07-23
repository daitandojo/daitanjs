// src/error/src/index.test.js
import {
  DaitanError,
  DaitanConfigurationError,
  DaitanInvalidInputError,
  DaitanValidationError,
  DaitanApiError,
  DaitanDatabaseError,
  DaitanNotFoundError,
  DaitanAuthenticationError,
  DaitanAuthorizationError,
  DaitanPaymentError,
  DaitanFileOperationError,
  DaitanNetworkError,
  DaitanOperationError,
  DaitanExternalDependencyError,
  DaitanBrowserSpecificError,
  DaitanScrapingError,
} from './index.js';

describe('@daitanjs/error', () => {
  describe('DaitanError (Base Class)', () => {
    it('should create an instance with all properties', () => {
      const originalError = new Error('Original cause');
      const details = { context: 'test' };
      const error = new DaitanError(
        'Base error message',
        'BASE_CODE',
        details,
        originalError
      );

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(DaitanError);
      expect(error.name).toBe('DaitanError');
      expect(error.message).toBe('Base error message');
      expect(error.code).toBe('BASE_CODE');
      expect(error.details).toEqual(details);
      expect(error.originalError).toBe(originalError);
      expect(typeof error.timestamp).toBe('string');
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('DaitanError: Base error message');
    });

    it('should create a plain object representation', () => {
      const originalError = new Error('Original cause');
      const error = new DaitanError(
        'A message',
        'A_CODE',
        { detail: 1 },
        originalError
      );
      const plain = error.toPlainObject();

      expect(plain.name).toBe('DaitanError');
      expect(plain.message).toBe('A message');
      expect(plain.code).toBe('A_CODE');
      expect(plain.details).toEqual({ detail: 1 });
      expect(plain.originalError.name).toBe('Error');
      expect(plain.originalError.message).toBe('Original cause');
      expect(plain.stackPreview).toContain('DaitanError: A message');
    });

    it('should handle a null originalError in toPlainObject', () => {
      const error = new DaitanError('A message', 'A_CODE', { detail: 1 }, null);
      const plain = error.toPlainObject();
      expect(plain).not.toHaveProperty('originalError');
    });
  });

  describe('Subclasses', () => {
    // A helper to test common subclass patterns
    const testSubclass = (
      ErrorClass,
      expectedName,
      expectedCode,
      defaultMessage
    ) => {
      describe(expectedName, () => {
        it('should have the correct name and default code', () => {
          const error = new ErrorClass('Test message');
          expect(error).toBeInstanceOf(DaitanError);
          expect(error.name).toBe(expectedName);
          expect(error.code).toBe(expectedCode);
          expect(error.message).toBe('Test message');
        });

        if (defaultMessage) {
          it('should have a default message if none is provided', () => {
            const error = new ErrorClass();
            expect(error.message).toBe(defaultMessage);
          });
        }

        it('should correctly store details and originalError', () => {
          const details = { info: 'extra' };
          const original = new Error('original');
          const error = new ErrorClass('Test message', details, original);
          expect(error.details).toEqual(details);
          expect(error.originalError).toBe(original);
        });
      });
    };

    testSubclass(
      DaitanConfigurationError,
      'DaitanConfigurationError',
      'CONFIGURATION_ERROR'
    );
    testSubclass(
      DaitanInvalidInputError,
      'DaitanInvalidInputError',
      'INVALID_INPUT'
    );
    testSubclass(
      DaitanValidationError,
      'DaitanValidationError',
      'VALIDATION_ERROR'
    );
    testSubclass(DaitanDatabaseError, 'DaitanDatabaseError', 'DATABASE_ERROR');
    testSubclass(
      DaitanNotFoundError,
      'DaitanNotFoundError',
      'NOT_FOUND',
      'Resource not found.'
    );
    testSubclass(
      DaitanAuthenticationError,
      'DaitanAuthenticationError',
      'AUTHENTICATION_ERROR',
      'Authentication failed.'
    );
    testSubclass(
      DaitanAuthorizationError,
      'DaitanAuthorizationError',
      'AUTHORIZATION_ERROR',
      'Authorization denied. Access forbidden.'
    );
    testSubclass(
      DaitanFileOperationError,
      'DaitanFileOperationError',
      'FILE_OPERATION_ERROR'
    );
    testSubclass(DaitanNetworkError, 'DaitanNetworkError', 'NETWORK_ERROR');
    testSubclass(
      DaitanOperationError,
      'DaitanOperationError',
      'OPERATION_FAILED'
    );
    testSubclass(
      DaitanExternalDependencyError,
      'DaitanExternalDependencyError',
      'EXTERNAL_DEPENDENCY_ERROR'
    );
    testSubclass(DaitanScrapingError, 'DaitanScrapingError', 'SCRAPING_ERROR');
  });

  describe('Specialized Subclasses', () => {
    it('DaitanApiError should store httpStatusCode', () => {
      const details = { apiName: 'TestAPI', httpStatusCode: 404 };
      const error = new DaitanApiError('API call failed', details);
      expect(error.name).toBe('DaitanApiError');
      expect(error.code).toBe('API_ERROR');
      expect(error.httpStatusCode).toBe(404);
      expect(error.details).toEqual(details);
    });

    it('DaitanPaymentError should extend DaitanApiError and set its own name', () => {
      const details = {
        apiName: 'Stripe',
        httpStatusCode: 402,
        gatewayErrorCode: 'card_declined',
      };
      const error = new DaitanPaymentError('Payment failed', details);
      expect(error).toBeInstanceOf(DaitanApiError);
      expect(error.name).toBe('DaitanPaymentError');
      expect(error.httpStatusCode).toBe(402);
      expect(error.details).toEqual(details);
    });

    it('DaitanBrowserSpecificError should extend DaitanOperationError and set its own name', () => {
      const error = new DaitanBrowserSpecificError('FS module used in browser');
      expect(error).toBeInstanceOf(DaitanOperationError);
      expect(error.name).toBe('DaitanBrowserSpecificError');
      // The code comes from the parent class
      expect(error.code).toBe('ENVIRONMENT_MISMATCH_ERROR');
    });
  });
});

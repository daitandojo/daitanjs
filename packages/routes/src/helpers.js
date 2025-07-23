// routes/src/helpers.js
/**
 * @file Helper utilities for API route handlers.
 * @module @daitanjs/routes/helpers
 *
 * @description
 * This module provides common utility functions for Next.js API route handlers,
 * such as handling errors and creating standardized JSON responses.
 */
import { NextResponse } from 'next/server';
import { getLogger } from '@daitanjs/development';
import { DaitanError, DaitanInvalidInputError } from '@daitanjs/error';

const apiHelpersLogger = getLogger('daitan-routes-helpers');

/**
 * Maps a DaitanJS error to an appropriate HTTP status code.
 * @private
 * @param {DaitanError | Error} error - The error object.
 * @returns {number} An HTTP status code.
 */
const getStatusFromError = (error) => {
  if (error instanceof DaitanError) {
    switch (error.name) {
      case 'DaitanAuthenticationError':
        return 401;
      case 'DaitanAuthorizationError':
        return 403;
      case 'DaitanNotFoundError':
        return 404;
      case 'DaitanInvalidInputError':
      case 'DaitanValidationError':
        return 400;
      case 'DaitanPaymentError':
        return error.httpStatusCode || 402; // 402 Payment Required or specific gateway error
      case 'DaitanApiError':
        return error.httpStatusCode || 502; // 502 Bad Gateway if external API fails
      case 'DaitanFileOperationError':
      case 'DaitanDatabaseError':
      case 'DaitanExternalDependencyError':
        return 503; // 503 Service Unavailable for dependency issues
      default:
        return 500; // Internal Server Error for other DaitanErrors
    }
  }
  // For generic, non-Daitan errors
  return 500;
};

/**
 * A standardized error handler for API routes. It logs the error and
 * returns a structured JSON response with an appropriate HTTP status code.
 *
 * @public
 * @param {any} error - The caught error.
 * @param {string} operationName - A descriptive name of the operation that failed, for logging.
 * @returns {NextResponse} A Next.js JSON response object for the error.
 */
export const handleApiError = (error, operationName) => {
  apiHelpersLogger.error(`API Error in "${operationName}":`, error);

  const status = getStatusFromError(error);
  const errorMessage = error.message || 'An unexpected error occurred.';
  const errorCode =
    error.code ||
    (error instanceof DaitanError ? error.name : 'UNEXPECTED_ERROR');

  return NextResponse.json(
    {
      success: false,
      error: errorMessage,
      code: errorCode,
      details: error.details || null,
    },
    { status }
  );
};

/**
 * Creates a standardized success response.
 *
 * @public
 * @param {any} data - The payload to send in the response.
 * @param {number} [status=200] - The HTTP status code.
 * @param {object} [metadata={}] - Optional metadata to include in the response body.
 * @returns {NextResponse} A Next.js JSON response object.
 */
export const createSuccessResponse = (data, status = 200, metadata = {}) => {
  const responseBody = {
    success: true,
    data,
    ...metadata,
  };
  return NextResponse.json(responseBody, { status });
};

/**
 * Safely parses the JSON body from a NextRequest.
 * Handles cases where the body is empty or malformed, and ensures it's an object.
 *
 * @public
 * @async
 * @param {import('next/server').NextRequest} req - The Next.js request object.
 * @returns {Promise<object>} The parsed JSON body.
 * @throws {DaitanInvalidInputError} If the request body is missing, not a plain object, or cannot be parsed as JSON.
 */
export const getJsonBody = async (req) => {
  try {
    const body = await req.json();
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      throw new DaitanInvalidInputError(
        'Request body must be a non-null JSON object.'
      );
    }
    return body;
  } catch (error) {
    if (error instanceof DaitanInvalidInputError) throw error;
    // Wrap JSON.parse errors
    throw new DaitanInvalidInputError(
      `Invalid or missing JSON request body: ${error.message}`,
      {},
      error
    );
  }
};

// middleware/src/index.js
/**
 * @file Reusable middleware functions for Next.js applications using DaitanJS.
 * @module @daitanjs/middleware
 *
 * @description
 * This package provides higher-order functions and utilities to be used as
 * middleware in a Next.js environment. The primary focus is on handling
 * cross-cutting concerns like authentication, authorization, and logging
 * in a clean, composable way.
 */

import { NextResponse } from 'next/server';
import { getLogger, getRequiredEnvVariable } from '@daitanjs/development';
import { verifyJWT } from '@daitanjs/security';
import { DaitanAuthenticationError, DaitanError } from '@daitanjs/error';

const logger = getLogger('daitan-middleware');

/**
 * A higher-order function that wraps a Next.js API route handler to add authentication.
 * It checks for a JWT in an 'auth-token' cookie or an 'Authorization: Bearer' header.
 * If the token is valid, it attaches the decoded payload to the request object as `req.user`
 * and calls the original handler. If not, it returns a 401 Unauthorized response.
 *
 * @public
 * @param {(req: import('next/server').NextRequest, context: any) => Promise<NextResponse>} handler - The original Next.js API route handler.
 * @param {object} [options={}] - Options for the authentication middleware.
 * @param {string} [options.jwtSecret] - The secret to verify the JWT. Defaults to the `JWT_SECRET` environment variable.
 * @param {string} [options.tokenCookieName='auth-token'] - The name of the cookie to check for the JWT.
 * @returns {(req: import('next/server').NextRequest, context: any) => Promise<NextResponse>} A new handler function with authentication logic.
 *
 * @example
 * // In your `app/api/protected-route/route.js`
 * import { withAuth } from '@daitanjs/middleware';
 *
 * async function myProtectedHandler(req) {
 *   // req.user is now available here and contains the JWT payload
 *   const userId = req.user.id;
 *   return new Response(JSON.stringify({ message: `Hello user ${userId}!` }));
 * }
 *
 * export const GET = withAuth(myProtectedHandler);
 */
export function withAuth(handler, options = {}) {
  return async (req, context) => {
    const { jwtSecret: explicitSecret, tokenCookieName = 'auth-token' } =
      options;

    logger.debug(
      `withAuth middleware: Executing for request to "${req.nextUrl.pathname}".`
    );

    let token = null;

    // 1. Try to get token from Authorization header
    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7); // Remove 'Bearer ' prefix
      logger.debug('withAuth: Found token in Authorization header.');
    }

    // 2. If not in header, try to get token from cookie
    if (!token) {
      const cookie = req.cookies.get(tokenCookieName);
      if (cookie?.value) {
        token = cookie.value;
        logger.debug(`withAuth: Found token in "${tokenCookieName}" cookie.`);
      }
    }

    if (!token) {
      logger.warn(
        `withAuth: Authentication token not found in request to "${req.nextUrl.pathname}".`
      );
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required. No token provided.',
        },
        { status: 401 }
      );
    }

    try {
      // Get the secret from options or fall back to environment variable
      const secret =
        explicitSecret ||
        getRequiredEnvVariable('JWT_SECRET', 'string', 'JWT signing secret');

      // Verify the JWT using the security package
      const decodedPayload = verifyJWT(token, secret);

      // Attach the user payload to the request object for the actual handler to use.
      // This is a common pattern, but be aware of modifying the request object.
      // An alternative is to pass it as an argument, but that requires changing the handler signature.
      req.user = decodedPayload;

      logger.info(
        `withAuth: JWT verified successfully for user/subject "${
          decodedPayload.sub || decodedPayload.id || 'unknown'
        }". Proceeding to handler.`
      );

      // Proceed to the original handler
      return handler(req, context);
    } catch (error) {
      logger.error('withAuth: JWT verification failed.', error);
      let errorMessage = 'Invalid or expired token.';
      let statusCode = 401; // Unauthorized

      if (error.name === 'TokenExpiredError') {
        errorMessage = 'Token has expired. Please log in again.';
      } else if (error.name === 'JsonWebTokenError') {
        errorMessage = 'Invalid token signature or format.';
      } else if (error instanceof DaitanError) {
        // e.g., DaitanConfigurationError if JWT_SECRET is missing
        errorMessage = 'Authentication service configuration error.';
        statusCode = 500;
      }

      return NextResponse.json(
        { success: false, error: errorMessage, code: error.name },
        { status: statusCode }
      );
    }
  };
}

// Placeholder for future middleware exports
// export { withLogging } from './loggingMiddleware.js';
// export { withRateLimit } from './rateLimitMiddleware.js';

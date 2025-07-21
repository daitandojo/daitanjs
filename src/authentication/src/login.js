// authentication/src/login.js
/**
 * @file Handles user login by verifying a Firebase ID token (obtained from client-side Firebase Auth).
 * @module @daitanjs/authentication/login
 *
 * @description
 * This module provides the `login` function, designed for server-side environments.
 * It expects an HTTP POST request containing a Firebase ID token in the JSON body.
 * The ID token is typically obtained from a client-side Firebase Authentication flow
 * (e.g., after a user signs in with email/password, Google, or another provider via Firebase Client SDK).
 *
 * The function verifies this ID token using the Firebase Admin SDK. Upon successful
 * verification, it returns user details extracted from the decoded token.
 * The application can then use these details to establish an application-specific session.
 *
 * This flow relies on the Firebase Admin SDK being initialized (see `firebaseAdmin.js`).
 *
 * Request Format:
 *   Method: POST
 *   Headers: Content-Type: application/json
 *   Body: { "idToken": "your_firebase_id_token_string" }
 *
 * Response Format (Success):
 *   Status: 200 OK
 *   Body: { "success": true, "user": { "uid": "...", "email": "...", ... } }
 *
 * Response Format (Error):
 *   Status: 400, 401, 403, 500, or 503
 *   Body: { "success": false, "error": "Error message string" }
 */
import { getFirebaseAdminAuth } from './firebaseAdmin.js'; // Use getter for explicit initialization
import { getLogger } from '@daitanjs/development';
import {
  DaitanValidationError, // This is an internal error, not from this function's direct inputs
  DaitanAuthenticationError, // Could be thrown by verifyIdToken
  DaitanConfigurationError, // If Firebase Admin SDK is not available
} from '@daitanjs/error';

const loginLogger = getLogger('daitan-auth-login'); // Updated logger name

/**
 * @typedef {Object} FirebaseIdTokenLoginPayload
 * @property {string} idToken - The Firebase ID token obtained from the client-side.
 */

/**
 * @typedef {Object} VerifiedFirebaseUserDetails
 * @property {string} uid - Firebase UID.
 * @property {string} email - User's email.
 * @property {boolean} emailVerified - Whether the email is verified by Firebase.
 * @property {string | null} name - User's display name (if available in token).
 * @property {string | null} picture - URL to user's profile picture (if available).
 * @property {string} signInProvider - The original sign-in provider (e.g., 'password', 'google.com').
 * @property {number} authTime - Authentication time (Unix timestamp in seconds).
 */

/**
 * @typedef {Object} LoginSuccessResponse
 * @property {true} success - Indicates successful token verification.
 * @property {VerifiedFirebaseUserDetails} user - The verified user details.
 * @property {string} [message] - Optional success message.
 */

/**
 * @typedef {Object} LoginErrorResponse
 * @property {false} success - Indicates failure.
 * @property {string} error - Error message.
 */

/**
 * Handles user login by verifying a Firebase ID token.
 * This function is designed for server-side environments and expects a standard `Request`-like object.
 *
 * @public
 * @async
 * @param {object} req - The incoming request object. Expected to have:
 *                       - `method`: HTTP method string (e.g., "POST").
 *                       - `text()`: An async function that returns the request body as a string.
 *                       (Compatible with Vercel Edge Functions, Cloudflare Workers, Node.js http with body parsing)
 * @returns {Promise<Response>} A standard `Response` object.
 *          On success (200 OK): `LoginSuccessResponse`.
 *          On error: Appropriate HTTP status (400, 401, 403, 405, 500, 503) with `LoginErrorResponse`.
 */
export async function login(req) {
  const callId = `login-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .substring(2, 7)}`;
  loginLogger.info(`[${callId}] Login request processing started.`);

  let firebaseAdminAuthService;
  try {
    firebaseAdminAuthService = getFirebaseAdminAuth();
  } catch (sdkError) {
    loginLogger.error(
      `[${callId}] Firebase Admin Auth SDK is not initialized. Cannot process login. Error: ${sdkError.message}`
    );
    return new Response(
      JSON.stringify({
        success: false,
        error:
          'Server authentication service unavailable. Please try again later.',
      }),
      {
        status: 503, // Service Unavailable
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  if (req.method !== 'POST') {
    loginLogger.warn(
      `[${callId}] Invalid HTTP method for login. Expected POST, got ${req.method}.`
    );
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Method Not Allowed. Please use POST.',
      }),
      {
        status: 405, // Method Not Allowed
        headers: { 'Content-Type': 'application/json', Allow: 'POST' },
      }
    );
  }

  let requestBody;
  try {
    if (typeof req.text !== 'function') {
      loginLogger.error(
        `[${callId}] Request object does not have a 'text()' method for body parsing.`
      );
      throw new Error('Server error: Invalid request object structure.');
    }
    const rawBody = await req.text();
    if (!rawBody || rawBody.trim() === '') {
      loginLogger.warn(
        `[${callId}] Request body is empty. Expected JSON with Firebase idToken.`
      );
      throw new DaitanValidationError(
        'Request body is empty. Expected JSON payload with idToken.'
      );
    }
    requestBody = JSON.parse(rawBody);
  } catch (e) {
    loginLogger.error(
      `[${callId}] Failed to parse request body as JSON or body was empty/invalid. Error: ${e.message}`,
      {
        originalErrorName: e.name,
        // rawBodyPreview: String(e.rawBodyPreview || '').substring(0,100) // If rawBody was captured
      }
    );
    const errorMsg =
      e instanceof DaitanValidationError
        ? e.message
        : 'Invalid request body: Must be valid JSON containing an idToken.';
    return new Response(JSON.stringify({ success: false, error: errorMsg }), {
      status: 400, // Bad Request
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { idToken } = requestBody;

  if (!idToken || typeof idToken !== 'string' || idToken.trim() === '') {
    loginLogger.warn(
      `[${callId}] Missing or invalid 'idToken' in request body for login.`
    );
    return new Response(
      JSON.stringify({
        success: false,
        error:
          'Firebase ID token (idToken) is required and must be a non-empty string.',
      }),
      {
        status: 400, // Bad Request
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    loginLogger.debug(
      `[${callId}] Verifying Firebase ID token. Token preview: ${idToken.substring(
        0,
        30
      )}...`
    );
    // Verify the ID token. `checkRevoked: true` ensures the token hasn't been revoked (e.g., user signed out elsewhere, password change).
    const decodedToken = await firebaseAdminAuthService.verifyIdToken(
      idToken,
      true
    );
    const uid = decodedToken.uid; // Firebase User ID

    loginLogger.info(
      `[${callId}] Firebase ID Token successfully verified for UID: ${uid}.`,
      {
        email: decodedToken.email,
        signInProvider: decodedToken.firebase?.sign_in_provider,
        auth_time: decodedToken.auth_time,
      }
    );

    // Construct user response object from decoded token claims
    // Applications would typically use this 'uid' to fetch/update their own user records
    // and then generate their own session token (e.g., a JWT).
    const userResponse = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      emailVerified: decodedToken.email_verified || false,
      name: decodedToken.name || null,
      picture: decodedToken.picture || null,
      signInProvider: decodedToken.firebase?.sign_in_provider || 'unknown', // e.g., 'password', 'google.com'
      authTime: decodedToken.auth_time, // Unix timestamp (seconds)
      // Other claims like decodedToken.iss, .aud, .sub, .iat, .exp could be included if needed
    };

    loginLogger.info(`[${callId}] Login successful for user.`, {
      uid: userResponse.uid,
    });
    return new Response(
      JSON.stringify({
        success: true,
        user: userResponse,
        message: 'Login successful.',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    // This catches errors from firebaseAdminAuth.verifyIdToken()
    loginLogger.error(
      `[${callId}] Error during Firebase ID token verification or processing: ${error.message}`,
      {
        errorCode: error.code, // Firebase specific error codes (e.g., 'auth/id-token-expired')
        errorName: error.name,
        // stack: error.stack, // For detailed debugging
      }
    );

    let publicMessage = 'Authentication failed. Invalid or expired token.';
    let statusCode = 401; // Unauthorized by default for token issues

    if (error.code) {
      // Firebase specific error codes
      switch (error.code) {
        case 'auth/id-token-expired':
          publicMessage =
            'Firebase ID token has expired. Please re-authenticate.';
          errorReason = 'ID_TOKEN_EXPIRED';
          break;
        case 'auth/id-token-revoked':
          publicMessage =
            'Firebase ID token has been revoked (e.g., due to session invalidation or password change). Please re-authenticate.';
          errorReason = 'ID_TOKEN_REVOKED';
          break;
        case 'auth/argument-error': // Often for malformed token
        case 'auth/invalid-id-token':
          publicMessage = 'Firebase ID token is invalid or malformed.';
          statusCode = 400; // Bad Request, as the token itself is bad
          errorReason = 'INVALID_ID_TOKEN_FORMAT';
          break;
        case 'auth/user-disabled':
          publicMessage =
            'This user account has been disabled by an administrator.';
          statusCode = 403; // Forbidden
          errorReason = 'USER_DISABLED';
          break;
        case 'auth/user-not-found': // Should not happen if token was validly issued, but possible
          publicMessage =
            'User associated with this token not found. The account may have been deleted.';
          statusCode = 404; // Not Found (conceptually for the user)
          errorReason = 'USER_NOT_FOUND';
          break;
        case 'auth/app-deleted':
        case 'auth/project-not-found':
          publicMessage =
            'Firebase project configuration error. Please contact support.';
          statusCode = 500; // Server configuration issue
          errorReason = 'FIREBASE_CONFIG_ISSUE';
          break;
        default:
          // For other Firebase errors not specifically handled, or if `error.code` is not set
          publicMessage =
            'Authentication failed due to a server-side issue with token verification.';
          statusCode = 500; // Internal Server Error
          errorReason = 'TOKEN_VERIFICATION_SERVER_ERROR';
      }
    }
    // Note: DaitanValidationError from body parsing is handled earlier.
    // DaitanConfigurationError for SDK init is handled earlier.
    // This catch block primarily handles DaitanAuthenticationError or wraps Firebase errors.

    return new Response(
      JSON.stringify({
        success: false,
        error: publicMessage,
        reasonCode: errorReason /* optional for client */,
      }),
      {
        status: statusCode,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

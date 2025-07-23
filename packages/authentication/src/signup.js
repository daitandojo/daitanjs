// authentication/src/signup.js
/**
 * @file Handles user sign-up with email and password using Firebase Admin SDK.
 * @module @daitanjs/authentication/signup
 *
 * @description
 * This module provides the `signUp` function, designed for server-side environments.
 * It expects an HTTP POST request with a JSON body containing `email`, `password`,
 * and optionally other user details like `displayName` and `photoURL`.
 *
 * The function uses the Firebase Admin SDK to:
 * 1. Create a new Firebase user with the provided email and password.
 * 2. (Optionally, but commonly) Generate a Firebase custom token for the newly created user.
 *    This custom token can then be sent back to the client, which uses it with the
 *    Firebase Client SDK's `signInWithCustomToken()` method to complete the sign-in flow
 *    on the client-side and obtain a Firebase ID token.
 *
 * This flow allows for server-controlled user creation while leveraging Firebase's
 * authentication backend. It relies on the Firebase Admin SDK being initialized
 * (see `firebaseAdmin.js`).
 *
 * Request Format:
 *   Method: POST
 *   Headers: Content-Type: application/json
 *   Body: {
 *     "email": "user@example.com",
 *     "password": "yourSecurePassword123",
 *     "displayName": "Optional Name", // Optional
 *     "photoURL": "Optional URL to photo" // Optional
 *   }
 *
 * Response Format (Success - 201 Created):
 *   Body: {
 *     "success": true,
 *     "message": "User created successfully.",
 *     "uid": "firebase_user_uid",
 *     "email": "user@example.com",
 *     "token": "firebase_custom_token_string" // If custom token generation is enabled
 *   }
 *
 * Response Format (Error):
 *   Status: 400 (Bad Request), 409 (Conflict), 415 (Unsupported Media Type), 500, 503
 *   Body: { "success": false, "error": "Error message string" }
 */
import { getFirebaseAdminAuth } from './firebaseAdmin.js'; // Use getter for explicit initialization
import { getLogger } from '@daitanjs/development';
import {
  DaitanValidationError, // This is an internal error, not from this function's direct inputs
  DaitanAuthenticationError, // Can be thrown by Firebase Admin create user
  DaitanConfigurationError, // If Firebase Admin SDK is not available
  DaitanOperationError, // For other operational errors
} from '@daitanjs/error';

const signUpLogger = getLogger('daitan-auth-signup'); // Updated logger name

/**
 * @typedef {Object} SignUpPayload
 * @property {string} email - The user's email address.
 * @property {string} password - The user's desired password.
 * @property {string} [displayName] - Optional display name for the user.
 * @property {string} [photoURL] - Optional URL to the user's profile photo.
 * @property {object} [customClaims] - Optional: Custom claims to set on the user token.
 */

/**
 * @typedef {Object} SignUpSuccessResponse
 * @property {true} success
 * @property {string} message
 * @property {string} uid - Firebase UID of the newly created user.
 * @property {string} email - Email of the newly created user.
 * @property {string} token - Firebase custom token for client-side sign-in.
 * @property {string} [displayName] - User's display name if provided.
 * @property {string} [photoURL] - User's photo URL if provided.
 */

/**
 * @typedef {Object} SignUpErrorResponse
 * @property {false} success
 * @property {string} error
 */

/**
 * Handles user sign-up with email and password using the Firebase Admin SDK.
 * Creates a Firebase user and returns a custom token for client-side sign-in.
 *
 * @public
 * @async
 * @param {object} req - The incoming request object. Expected to have:
 *                       - `method`: HTTP method string (e.g., "POST").
 *                       - `headers`: A `Headers`-like object with a `get(name)` method.
 *                       - `text()`: An async function that returns the request body as a string.
 * @returns {Promise<Response>} A standard `Response` object.
 */
export async function signUp(req) {
  const callId = `signup-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .substring(2, 7)}`;
  const startTime = Date.now();
  signUpLogger.info(`[${callId}] Sign-up request processing started.`, {
    method: req?.method,
    url: req?.url,
  });

  // Optional: Basic memory monitoring for server environments
  if (
    typeof process !== 'undefined' &&
    process.memoryUsage &&
    signUpLogger.isLevelEnabled('debug')
  ) {
    const memoryUsage = process.memoryUsage();
    signUpLogger.debug(`[${callId}] Memory usage at start of signUp:`, {
      rssMB: Math.round(memoryUsage.rss / 1024 / 1024),
      heapUsedMB: Math.round(memoryUsage.heapUsed / 1024 / 1024),
    });
  }

  let firebaseAdminAuthService;
  try {
    firebaseAdminAuthService = getFirebaseAdminAuth();
  } catch (sdkError) {
    signUpLogger.error(
      `[${callId}] Firebase Admin Auth SDK is not initialized. Cannot proceed with signup. Error: ${sdkError.message}`
    );
    return new Response(
      JSON.stringify({
        success: false,
        error:
          'Server authentication service is currently unavailable. Please try again later.',
      }),
      {
        status: 503, // Service Unavailable
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Validate Request Method
  if (req.method !== 'POST') {
    signUpLogger.warn(
      `[${callId}] Invalid HTTP method for signup. Expected POST, got ${req.method}.`
    );
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Method Not Allowed. Please use POST.',
      }),
      {
        status: 405,
        headers: { 'Content-Type': 'application/json', Allow: 'POST' },
      }
    );
  }

  // Validate Content Type
  const contentType = req.headers?.get('content-type');
  if (!contentType || !contentType.toLowerCase().includes('application/json')) {
    signUpLogger.error(
      `[${callId}] Invalid content-type for signup. Expected application/json, got "${contentType}".`
    );
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Invalid content type. Expected application/json.',
      }),
      {
        status: 415, // Unsupported Media Type
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Parse Request Body
  let requestBodyJson;
  let rawRequestBodyForLog = '';
  try {
    if (typeof req.text !== 'function') {
      signUpLogger.error(
        `[${callId}] Request object does not have a 'text()' method for body parsing.`
      );
      throw new Error(
        'Server error: Invalid request object structure for body parsing.'
      );
    }
    rawRequestBodyForLog = await req.text();
    if (!rawRequestBodyForLog || rawRequestBodyForLog.trim() === '') {
      signUpLogger.warn(
        `[${callId}] Request body is empty. Expected JSON with email and password.`
      );
      throw new DaitanValidationError(
        'Request body cannot be empty. Expected JSON payload.'
      );
    }
    requestBodyJson = JSON.parse(rawRequestBodyForLog);
  } catch (e) {
    signUpLogger.error(
      `[${callId}] Failed to parse request body as JSON or body was empty. Error: ${e.message}`,
      {
        originalErrorName: e.name,
        bodyPreview:
          rawRequestBodyForLog.substring(0, 200) +
          (rawRequestBodyForLog.length > 200 ? '...' : ''),
      }
    );
    const errorMsg =
      e instanceof DaitanValidationError
        ? e.message
        : 'Invalid JSON format in request body.';
    return new Response(JSON.stringify({ success: false, error: errorMsg }), {
      status: 400, // Bad Request
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { email, password, displayName, photoURL, customClaims, ...otherData } =
    requestBodyJson;
  const loggableOtherDataKeys = Object.keys(otherData);
  if (loggableOtherDataKeys.length > 0) {
    signUpLogger.debug(
      `[${callId}] Received additional data in signup payload (will be ignored by Firebase user creation unless handled):`,
      { otherDataKeys: loggableOtherDataKeys }
    );
  }

  // Validate Email and Password
  if (
    !email ||
    typeof email !== 'string' ||
    email.trim() === '' ||
    !/\S+@\S+\.\S+/.test(email)
  ) {
    // Basic email format check
    signUpLogger.warn(`[${callId}] Missing or invalid email for signup.`, {
      emailProvided: email,
    });
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Valid email address is required.',
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
  const normalizedEmail = email.trim().toLowerCase(); // Normalize email for storage and checks

  if (!password || typeof password !== 'string' || password.length < 8) {
    // Basic password length check
    signUpLogger.warn(
      `[${callId}] Missing or weak password for signup (email: ${normalizedEmail}). Min length 8.`
    );
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Password is required and must be at least 8 characters long.',
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
  // Consider adding more password strength validation if needed, e.g., using @daitanjs/validation isPassword

  signUpLogger.info(
    `[${callId}] Starting Firebase user creation for email: ${normalizedEmail}.`
  );
  try {
    const userRecord = await firebaseAdminAuthService.createUser({
      email: normalizedEmail,
      password: password, // Firebase Admin SDK handles hashing
      emailVerified: false, // Typically, email verification is a separate step initiated by client
      disabled: false,
      ...(displayName &&
        typeof displayName === 'string' && { displayName: displayName.trim() }),
      ...(photoURL &&
        typeof photoURL === 'string' && { photoURL: photoURL.trim() }),
    });
    signUpLogger.info(
      `[${callId}] Firebase user created successfully. UID: ${userRecord.uid}.`
    );

    // Optionally, set custom claims if provided and valid
    if (
      customClaims &&
      typeof customClaims === 'object' &&
      Object.keys(customClaims).length > 0
    ) {
      try {
        await firebaseAdminAuthService.setCustomUserClaims(
          userRecord.uid,
          customClaims
        );
        signUpLogger.info(
          `[${callId}] Custom claims set for user UID: ${userRecord.uid}.`,
          { claims: Object.keys(customClaims) }
        );
      } catch (claimsError) {
        signUpLogger.warn(
          `[${callId}] Failed to set custom claims for user UID: ${userRecord.uid}. Error: ${claimsError.message}. User creation still successful.`,
          { claimsErrorName: claimsError.name }
        );
        // Non-fatal for signup, but log it.
      }
    }

    // Generate a custom token for the client to sign in with.
    // This is a common pattern for server-side user creation.
    const customToken = await firebaseAdminAuthService.createCustomToken(
      userRecord.uid
    );
    signUpLogger.info(
      `[${callId}] Custom token generated for UID: ${userRecord.uid}.`
    );

    const successPayload = {
      success: true,
      message:
        'User created successfully. Use the token to sign in on the client.',
      uid: userRecord.uid,
      email: userRecord.email, // Should be the normalizedEmail
      token: customToken,
      ...(userRecord.displayName && { displayName: userRecord.displayName }),
      ...(userRecord.photoURL && { photoURL: userRecord.photoURL }),
    };
    signUpLogger.info(
      `[${callId}] User sign-up process successful for UID: ${userRecord.uid}.`
    );
    return new Response(JSON.stringify(successPayload), {
      status: 201, // 201 Created
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (firebaseError) {
    signUpLogger.error(
      `[${callId}] Firebase operation error during sign-up for email "${normalizedEmail}".`,
      {
        errorCode: firebaseError.code, // Firebase specific error code
        errorMessage: firebaseError.message,
        // errorStackPreview: firebaseError.stack?.substring(0, 200), // For debug
      }
    );

    let publicErrorMessage = 'Registration failed. Please try again later.';
    let publicStatusCode = 500; // Internal Server Error by default

    if (firebaseError.code) {
      switch (firebaseError.code) {
        case 'auth/email-already-exists':
          publicErrorMessage =
            'An account with this email address already exists. Please try logging in or use a different email.';
          publicStatusCode = 409; // Conflict
          break;
        case 'auth/invalid-email':
          publicErrorMessage = 'The email address provided is not valid.';
          publicStatusCode = 400; // Bad Request
          break;
        case 'auth/invalid-password': // Firebase Admin SDK errors for password (e.g. too short)
          publicErrorMessage = firebaseError.message; // Use Firebase's specific message
          publicStatusCode = 400;
          break;
        case 'auth/uid-already-exists': // Less likely with Admin SDK createUser unless UID is explicitly passed and conflicts
          publicErrorMessage = 'A user with this identifier already exists.';
          publicStatusCode = 409;
          break;
        case 'auth/operation-not-allowed':
          publicErrorMessage =
            'Email/password sign-up is currently not enabled for this project.';
          publicStatusCode = 403; // Forbidden
          break;
        // Add other specific Firebase Admin SDK error codes as needed
        default:
          signUpLogger.error(
            `[${callId}] Unexpected Firebase error during user creation or token generation.`,
            { firebaseError }
          );
        // Keep generic public error for truly unexpected internal Firebase errors
      }
    } else if (firebaseError instanceof DaitanValidationError) {
      // This shouldn't happen if input validation is done before createUser, but as a safeguard
      publicErrorMessage = firebaseError.message;
      publicStatusCode = 400;
    }

    return new Response(
      JSON.stringify({ success: false, error: publicErrorMessage }),
      {
        status: publicStatusCode,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } finally {
    // Note: DO NOT delete appInstance (admin.app().delete()) here. Firebase Admin apps are singletons.
    const duration = Date.now() - startTime;
    signUpLogger.info(
      `[${callId}] Sign-up request completed. Total duration: ${duration}ms.`
    );
    if (
      typeof process !== 'undefined' &&
      process.memoryUsage &&
      signUpLogger.isLevelEnabled('debug')
    ) {
      const memoryUsageEnd = process.memoryUsage();
      signUpLogger.debug(`[${callId}] Memory usage at end of signUp:`, {
        rssMB: Math.round(memoryUsageEnd.rss / 1024 / 1024),
        heapUsedMB: Math.round(memoryUsageEnd.heapUsed / 1024 / 1024),
      });
    }
  }
}

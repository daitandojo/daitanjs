// authentication/src/googleLogin.js
/**
 * @file Handles Google Sign-In by verifying a Google ID token using Firebase Admin SDK.
 * @module @daitanjs/authentication/googleLogin
 *
 * @description
 * This module provides the `googleLogin` function, intended for server-side use.
 * It takes a Google ID token (obtained from a client-side Google Sign-In flow,
 * e.g., using Google Identity Services library or Firebase Client SDK with Google provider)
 * and verifies it using the Firebase Admin SDK.
 *
 * Upon successful verification, it returns user details extracted from the decoded token.
 * The application can then use these details to find/create a local user record and
 * establish an application session.
 *
 * This flow relies on the Firebase Admin SDK being initialized (see `firebaseAdmin.js`).
 * It provides a secure way to authenticate users who signed in with Google on the client.
 */
import { getFirebaseAdminAuth } from './firebaseAdmin.js'; // Use getter for explicit initialization
import { getLogger } from '@daitanjs/development';
import {
  DaitanValidationError,
  DaitanAuthenticationError,
  DaitanConfigurationError, // For Firebase Admin SDK not being available
} from '@daitanjs/error';

const googleLoginLogger = getLogger('daitan-auth-google-login'); // Updated logger name

/**
 * @typedef {Object} GoogleLoginPayload
 * @property {string} idToken - The Google ID token obtained from the client-side Google Sign-In flow.
 */

/**
 * @typedef {Object} VerifiedGoogleUserDetails
 * @property {string} uid - Firebase UID for this user (unique within your Firebase project).
 *                          This is often the primary identifier to link with your application's user records.
 * @property {string} email - The user's email address.
 * @property {string} name - The user's display name.
 * @property {string} picture - URL to the user's profile picture.
 * @property {boolean} emailVerified - Whether Google has verified the user's email address.
 * @property {string} providerId - The sign-in provider ID (e.g., 'google.com').
 * @property {number} [authTime] - The time the user was authenticated, as a Unix timestamp in seconds. (From decodedToken.auth_time)
 */

/**
 * @typedef {Object} GoogleLoginSuccessResponse
 * @property {true} success - Indicates successful verification.
 * @property {VerifiedGoogleUserDetails} user - The verified user details from the Google ID token.
 */

/**
 * Handles Google Sign-In by verifying a Google ID token using the Firebase Admin SDK.
 * This function is intended for server-side use.
 *
 * @public
 * @async
 * @param {GoogleLoginPayload} payload - The request payload containing the `idToken`.
 * @param {string} payload.idToken - The Google ID token provided by the client.
 * @returns {Promise<GoogleLoginSuccessResponse>} On success, an object with `success: true` and `user` details.
 * @throws {DaitanValidationError} If `idToken` is missing or invalid.
 * @throws {DaitanConfigurationError} If Firebase Admin Auth SDK is not initialized or available.
 * @throws {DaitanAuthenticationError} If token verification fails (e.g., expired, revoked, invalid signature, malformed payload).
 */
export async function googleLogin({ idToken }) {
  const callId = `ggl-login-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .substring(2, 7)}`;
  googleLoginLogger.info(
    `[${callId}] Processing Google Login request with ID token.`
  );

  let firebaseAdminAuthService;
  try {
    firebaseAdminAuthService = getFirebaseAdminAuth(); // Ensures Firebase Admin SDK is initialized
  } catch (sdkError) {
    // This error is likely DaitanConfigurationError or DaitanOperationError from firebaseAdmin.js
    googleLoginLogger.error(
      `[${callId}] Firebase Admin Auth SDK is not available. Cannot process Google login. Error: ${sdkError.message}`
    );
    throw new DaitanConfigurationError(
      'Firebase Admin Auth service is not available due to a server configuration or initialization error. Google login cannot proceed.',
      {
        criticalService: 'FirebaseAdminAuth',
        originalErrorName: sdkError.name,
      },
      sdkError
    );
  }

  if (!idToken || typeof idToken !== 'string' || idToken.trim() === '') {
    googleLoginLogger.warn(
      `[${callId}] Invalid or missing Google ID token provided for login.`
    );
    throw new DaitanValidationError(
      'Google ID token is required and must be a non-empty string.'
    );
  }

  try {
    googleLoginLogger.debug(
      `[${callId}] Verifying Google ID token with Firebase Admin SDK. Token preview: ${idToken.substring(
        0,
        30
      )}...`
    );
    // Step 1: Verify ID token using Firebase Admin SDK.
    // The `checkRevoked` flag (second argument true) ensures that if the user's session was
    // revoked (e.g., password change, manual revocation), the token is considered invalid.
    const decodedToken = await firebaseAdminAuthService.verifyIdToken(
      idToken,
      true
    );
    googleLoginLogger.info(
      `[${callId}] Google ID Token verified successfully. Firebase UID: ${decodedToken.uid}`,
      {
        email: decodedToken.email,
        auth_time: decodedToken.auth_time,
        firebaseSignInProvider: decodedToken.firebase?.sign_in_provider,
      }
    );

    const { uid, email, name, picture, email_verified, auth_time } =
      decodedToken;

    // Essential claims check
    if (!uid || !email) {
      googleLoginLogger.error(
        `[${callId}] Critical identity information (Firebase UID or email) is missing in the decoded Google ID token. This is unexpected.`,
        { decodedToken }
      );
      throw new DaitanAuthenticationError(
        'Invalid Google ID token payload: UID or email is missing after verification.',
        'INVALID_TOKEN_PAYLOAD' // Error reason code
      );
    }

    // Optional: Policy check for email_verified (depends on application requirements)
    // if (!email_verified) {
    //   googleLoginLogger.warn(`[${callId}] Google email (${email}) for UID ${uid} is not verified by Google. Proceeding, but application policy may differ.`, { uid });
    //   // Example: throw new DaitanAuthenticationError('Google email not verified. Please verify your email with Google first.', 'EMAIL_NOT_VERIFIED');
    // }

    // Step 2: Prepare user details for the response.
    // The application consuming this function would typically use these details to:
    // - Find or create a user record in its own database, linking it with `uid`.
    // - Update local user profile information (name, picture) if it has changed.
    // - Generate an application-specific session token (e.g., a JWT) for the authenticated user.
    // This library function returns the verified user details from Google/Firebase.
    const userDetails = {
      uid, // Firebase UID, unique to this user within your Firebase project
      email,
      name: name || '', // Fallback to empty string if name is not present in token
      picture: picture || '', // Fallback
      emailVerified: email_verified || false, // Ensure boolean
      providerId: decodedToken.firebase?.sign_in_provider || 'google.com', // Should be 'google.com'
      authTime: auth_time, // Unix timestamp (seconds) of authentication
      // Other potentially useful claims from decodedToken:
      // decodedToken.iss, decodedToken.aud, decodedToken.sub, decodedToken.iat, decodedToken.exp
      // decodedToken.firebase.identities (object mapping providers to arrays of UIDs for that provider)
    };

    googleLoginLogger.debug(
      `[${callId}] Prepared user details from verified token.`,
      { uid }
    );

    return {
      success: true,
      user: userDetails,
    };
  } catch (error) {
    googleLoginLogger.error(
      `[${callId}] Failed to verify Google ID token or process login: ${error.message}`,
      {
        errorName: error.name,
        errorCode: error.code, // Firebase errors (like from verifyIdToken) often have a `code` property
        // stack: error.stack, // For detailed debugging in dev environments
      }
    );

    let publicMessage = 'Failed to verify Google ID token.';
    let errorReason = 'TOKEN_VERIFICATION_FAILED'; // Default DaitanAuthenticationError reason

    // Handle Firebase specific error codes from verifyIdToken
    if (error.code) {
      switch (error.code) {
        case 'auth/id-token-expired':
          publicMessage = 'Google ID token has expired. Please sign in again.';
          errorReason = 'ID_TOKEN_EXPIRED';
          break;
        case 'auth/id-token-revoked':
          publicMessage =
            'Google ID token has been revoked (e.g., due to password change or session invalidation). Please sign in again.';
          errorReason = 'ID_TOKEN_REVOKED';
          break;
        case 'auth/argument-error': // Often for malformed token
        case 'auth/invalid-id-token':
          publicMessage = 'Google ID token is malformed or invalid.';
          errorReason = 'INVALID_ID_TOKEN_FORMAT';
          break;
        case 'auth/app-deleted':
        case 'auth/project-not-found':
          publicMessage =
            'Firebase project configuration issue. Please contact support.';
          errorReason = 'FIREBASE_CONFIG_ISSUE';
          // This might also be thrown as DaitanConfigurationError if it happens earlier.
          throw new DaitanConfigurationError(
            publicMessage,
            { originalFirebaseCode: error.code },
            error
          );
        // Add more Firebase Admin SDK specific error codes as needed.
        // See: https://firebase.google.com/docs/reference/admin/node/firebase-admin.auth.authcodeerror
      }
    } else if (
      error instanceof DaitanAuthenticationError ||
      error instanceof DaitanValidationError
    ) {
      // If it's already one of our specific errors (e.g., from UID/email check or earlier validation)
      throw error;
    }

    // For other errors, or if a Firebase error wasn't specifically handled above, throw a generic DaitanAuthenticationError.
    throw new DaitanAuthenticationError(publicMessage, errorReason, {
      originalErrorMessage: error.message,
      originalErrorCode: error.code, // Include original code if present
    });
  }
}

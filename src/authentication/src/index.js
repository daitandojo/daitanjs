// authentication/src/index.js
/**
 * @file Main entry point for the @daitanjs/authentication package.
 * @module @daitanjs/authentication
 *
 * @description
 * This package provides a suite of utilities for handling user authentication,
 * primarily leveraging Firebase. It includes functionalities for:
 *
 * - **Firebase Admin SDK Management**: Secure initialization and access to Firebase Admin
 *   services, especially `Auth` for server-side operations like token verification
 *   and user management.
 * - **Google Sign-In Flows**:
 *   - `googleLogin`: Server-side verification of Google ID tokens obtained from client-side flows.
 *   - `googleCallBack`: Server-side handler for OAuth 2.0 callbacks from Google,
 *     useful for server-initiated OAuth flows.
 * - **Standard Email/Password Authentication Flows (via Firebase)**:
 *   - `signUp`: Server-side user creation with email/password, returning a custom token
 *     for client-side sign-in.
 *   - `login`: Server-side verification of Firebase ID tokens (from any Firebase sign-in method
 *     on the client, including email/password, Google, etc.).
 *   - `logout`: A server-side acknowledgment endpoint for logout requests (client handles actual token clearing).
 *
 * All operations are designed for server-side environments and integrate with other
 * DaitanJS packages for logging, error handling, and configuration.
 */
import { getLogger } from '@daitanjs/development';

const authIndexLogger = getLogger('daitan-auth-index'); // Consistent logger name

authIndexLogger.debug('Exporting DaitanJS Authentication modules...');

// --- Firebase Admin SDK Core Exports ---
// These provide access to the initialized Firebase Admin services.
// JSDoc for these is in `firebaseAdmin.js`.
export {
  getFirebaseAdminAuth, // Recommended getter for Auth service
  getFirebaseAdminApp, // Recommended getter for App instance
  auth as firebaseAdminAuth, // Legacy/convenience direct export (initializes on first access)
  adminApp as firebaseAdminApp, // Legacy/convenience direct export
  verifyAdminAuthConnection, // Health check for the Admin Auth connection
  // getAdminStorage, adminStorage are deprecated placeholders in firebaseAdmin.js and not re-exported here for clarity.
} from './firebaseAdmin.js';

// --- Google OAuth Specific Flows ---
// JSDoc for these is in their respective files.
export { googleCallBack } from './googleCallback.js'; // Server-side OAuth 2.0 callback handler
export { googleLogin } from './googleLogin.js'; // Server-side Google ID token verification

// --- Standard Firebase Authentication Flows (Email/Password, ID Token Verification) ---
// JSDoc for these is in their respective files.
export { login } from './login.js'; // Verifies any Firebase ID token
export { signUp } from './signup.js'; // Creates user with email/password via Admin SDK
export { logout } from './logout.js'; // Server-side logout acknowledgment (client handles token clearing)

// --- Potential Future User Management Wrappers ---
// If wrappers around Firebase Admin user management functions (createUser, updateUser, deleteUser, etc.)
// were to be added for more DaitanJS-specific logic or error handling, they could be exported from
// a dedicated `userManagement.js` file and re-exported here.
// Example:
// export {
//   createFirebaseUserWithAdmin,
//   updateFirebaseUserWithAdmin,
//   deleteFirebaseUserWithAdmin,
//   getFirebaseUserByUid,
//   listFirebaseUsers
// } from './userManagement.js'; // (If such a file existed)

authIndexLogger.info('DaitanJS Authentication module exports ready.');

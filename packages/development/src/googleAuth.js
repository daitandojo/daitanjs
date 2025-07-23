// src/development/src/googleAuth.js
/**
 * @file Google OAuth2 client initialization.
 * @module @daitanjs/development/googleAuth
 *
 * @description
 * This module is responsible for initializing and providing a singleton instance of the
 * Google OAuth2 client from the `googleapis` library. This client is essential for
 * any DaitanJS functionalities that need to interact with Google APIs on behalf of a user,
 * such as the Google Calendar or Gmail tools in `@daitanjs/intelligence`.
 *
 * It relies on environment variables for configuration and ensures that the client is
 * only initialized once per application lifecycle.
 *
 * Required Environment Variables:
 * - `GOOGLE_CLIENT_ID`: Your Google Cloud project's OAuth Client ID.
 * - `GOOGLE_CLIENT_SECRET`: Your Google Cloud project's OAuth Client Secret.
 * - `GOOGLE_REDIRECT_URI`: The primary redirect URI registered in your Google Cloud project.
 */
import { google } from 'googleapis';
import { getRequiredEnvVariable } from './environment.js';
import { getLogger } from './logger.js';
import { DaitanConfigurationError } from '@daitanjs/error';

const googleAuthLogger = getLogger('daitan-dev-google-auth');

// Module-level singleton instance for the OAuth2 client.
let oauth2ClientInstance = null;

/**
 * Initializes and returns a pre-configured Google OAuth2 client.
 * This function assigns to the module-level singleton `oauth2ClientInstance`.
 *
 * @private
 * @returns {import('google-auth-library').OAuth2Client} The initialized OAuth2 client.
 * @throws {DaitanConfigurationError} If required environment variables are missing or invalid.
 */
function initializeOAuth2Client() {
  // This check prevents re-initialization if already done.
  if (oauth2ClientInstance) {
    googleAuthLogger.debug('Returning existing Google OAuth2 client instance.');
    return oauth2ClientInstance;
  }

  googleAuthLogger.info(
    'Initializing Google OAuth2 client for @daitanjs/development...'
  );
  try {
    const clientId = getRequiredEnvVariable(
      'GOOGLE_CLIENT_ID',
      'string',
      'Google OAuth Client ID'
    );
    const clientSecret = getRequiredEnvVariable(
      'GOOGLE_CLIENT_SECRET',
      'string',
      'Google OAuth Client Secret'
    );
    const redirectUri = getRequiredEnvVariable(
      'GOOGLE_REDIRECT_URI',
      'string',
      'Google OAuth Redirect URI'
    );

    // Assign to the module-level singleton variable
    oauth2ClientInstance = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );
    googleAuthLogger.info('Google OAuth2 client initialized successfully.');
    return oauth2ClientInstance;
  } catch (error) {
    googleAuthLogger.error('Failed to initialize Google OAuth2 client.', {
      errorMessage: error.message,
      errorName: error.name,
    });
    // If getRequiredEnvVariable threw DaitanConfigurationError, re-throw it.
    if (error instanceof DaitanConfigurationError) throw error;
    // Otherwise, wrap it.
    throw new DaitanConfigurationError(
      `Google OAuth2 client setup failed: ${error.message}`,
      {},
      error
    );
  }
}

/**
 * Gets the singleton instance of the Google OAuth2 client.
 * Initializes the client on the first call.
 *
 * @public
 * @returns {import('google-auth-library').OAuth2Client} The singleton OAuth2 client instance.
 * @throws {DaitanConfigurationError} If the client cannot be initialized due to missing configuration.
 */
export const getGoogleAuthClient = () => {
  if (!oauth2ClientInstance) {
    // This will either initialize the client or throw a DaitanConfigurationError
    initializeOAuth2Client();
  }
  return oauth2ClientInstance;
};

// Export the getter function itself as the default export.
// This allows consumers to call `getGoogleAuthClient()` to ensure initialization.
export default getGoogleAuthClient;

// authentication/src/googleCallback.js
/**
 * @file Handles Google OAuth 2.0 callback for server-side authentication flows.
 * @module @daitanjs/authentication/googleCallback
 *
 * @description
 * This module provides functionality to handle the server-side part of a Google OAuth 2.0
 * authentication flow. It initializes a Google OAuth2 client using credentials from
 * environment variables and includes a `googleCallBack` function designed to process
 * the authorization code received from Google after user consent. This function exchanges
 * the code for tokens and fetches user information.
 *
 * This is typically used in web applications where the server initiates an OAuth flow,
 * redirects the user to Google, and Google redirects back to a callback URL handled by
 * this module.
 *
 * Required Environment Variables:
 * - `GOOGLE_CLIENT_ID`: Your Google Cloud project's OAuth Client ID.
 * - `GOOGLE_CLIENT_SECRET`: Your Google Cloud project's OAuth Client Secret.
 * - `GOOGLE_REDIRECT_URI`: The redirect URI registered in your Google Cloud console that points to this callback handler.
 *
 * Standard `Response` objects are used for compatibility with various serverless environments
 * (e.g., Vercel Edge Functions, Cloudflare Workers) or Node.js HTTP servers.
 */
import { google } from 'googleapis';
import { getLogger, getRequiredEnvVariable } from '@daitanjs/development';
import {
  DaitanConfigurationError,
  DaitanOperationError,
  DaitanApiError, // For errors from Google API itself
} from '@daitanjs/error';

const googleCallbackLogger = getLogger('daitan-auth-google-callback'); // Updated logger name

let oauth2ClientInstance = null; // Singleton OAuth2 client instance

/**
 * Initializes and returns the Google OAuth2 client.
 * This function is idempotent and caches the client instance.
 * Relies on environment variables: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`.
 *
 * @private
 * @returns {import('google-auth-library').OAuth2Client} The initialized Google OAuth2 client.
 * @throws {DaitanConfigurationError} If required Google OAuth environment variables are missing or invalid.
 */
const getOAuth2ClientInternal = () => {
  if (oauth2ClientInstance) {
    return oauth2ClientInstance;
  }

  googleCallbackLogger.info(
    'Initializing Google OAuth2 client for callback handler...'
  );
  try {
    const clientId = getRequiredEnvVariable(
      'GOOGLE_CLIENT_ID',
      'string',
      'Google Client ID'
    );
    const clientSecret = getRequiredEnvVariable(
      'GOOGLE_CLIENT_SECRET',
      'string',
      'Google Client Secret'
    );
    // This redirect URI MUST match one registered in your Google Cloud Console for this client ID.
    const redirectUri = getRequiredEnvVariable(
      'GOOGLE_REDIRECT_URI',
      'string',
      'Google OAuth Redirect URI for server callback'
    );

    oauth2ClientInstance = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );
    googleCallbackLogger.info(
      'Google OAuth2 client initialized successfully for callback handler.'
    );
    return oauth2ClientInstance;
  } catch (error) {
    googleCallbackLogger.error(
      'Failed to initialize Google OAuth2 client due to missing or invalid configuration.',
      {
        errorMessage: error.message,
        errorName: error.name,
      }
    );
    if (error instanceof DaitanConfigurationError) throw error; // Re-throw if already specific
    throw new DaitanConfigurationError(
      `Google OAuth2 client configuration error for callback: ${error.message}`,
      { originalErrorName: error.name },
      error
    );
  }
};

/**
 * Handles the Google OAuth callback from the client/browser.
 * This function should be mapped to the server route specified as the redirect URI in Google Cloud Console.
 * It exchanges the authorization `code` (from query parameters) for access and ID tokens,
 * then fetches basic user profile information from Google.
 *
 * @public
 * @async
 * @param {object} req - The incoming request object, expected to have a `url` property
 *                       (e.g., from Node.js `http.IncomingMessage` or similar server framework request object).
 *                       The URL should contain the `code` and optionally `state` query parameters from Google.
 * @returns {Promise<Response>} A standard `Response` object.
 *          - On success: HTTP 200 with JSON `{ user: GoogleUserInfo }` where `GoogleUserInfo`
 *            is the user's profile data from Google (e.g., id, email, name, picture).
 *          - On error: HTTP 400 (bad request, e.g., missing code, invalid code) or
 *            HTTP 500/502 (server-side/Google API issue) with JSON `{ error: string }`.
 * @throws {DaitanConfigurationError} Implicitly via `getOAuth2ClientInternal` if OAuth client cannot be configured.
 *         This error is caught and converted to a 500 response.
 */
export async function googleCallBack(req) {
  const callId = `gcb-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .substring(2, 7)}`;
  googleCallbackLogger.info(`[${callId}] googleCallBack: Received request.`, {
    url: req?.url,
  });

  let oauth2Client;
  try {
    oauth2Client = getOAuth2ClientInternal(); // Ensures client is initialized
  } catch (configError) {
    // Error already logged by getOAuth2ClientInternal
    return new Response(
      JSON.stringify({
        error: `Server configuration error for Google OAuth: ${configError.message}`,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    if (!req || !req.url) {
      googleCallbackLogger.error(
        `[${callId}] Request object or request URL is missing.`
      );
      throw new DaitanConfigurationError(
        'Request URL is undefined, cannot process Google OAuth callback.'
      );
    }

    // Construct URL object. The base is needed if req.url is just a path (e.g., "/oauth2callback?code=...")
    const requestUrl = new URL(
      req.url,
      `http://${req.headers?.host || 'localhost'}`
    );
    const code = requestUrl.searchParams.get('code');

    if (!code) {
      googleCallbackLogger.warn(
        `[${callId}] Authorization code ('code') missing in Google callback URL.`
      );
      return new Response(
        JSON.stringify({
          error: 'Authorization code missing in callback from Google.',
        }),
        {
          status: 400, // Bad Request
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
    googleCallbackLogger.debug(`[${callId}] Authorization code received.`, {
      codePreview: String(code).substring(0, 20) + '...',
    });

    // Step 1: Exchange authorization code for tokens
    googleCallbackLogger.debug(
      `[${callId}] Attempting to exchange code for Google OAuth tokens.`
    );
    const { tokens } = await oauth2Client.getToken(code);
    // `tokens` will contain access_token, refresh_token (if configured for offline access and first consent),
    // scope, token_type, id_token, expiry_date.
    oauth2Client.setCredentials(tokens); // Authenticate the client instance with these tokens for subsequent API calls.
    googleCallbackLogger.info(
      `[${callId}] Successfully obtained and set Google OAuth tokens.`,
      {
        hasAccessToken: !!tokens.access_token,
        hasIdToken: !!tokens.id_token, // id_token contains user identity info
        hasRefreshToken: !!tokens.refresh_token,
        scope: tokens.scope,
        idTokenPreview: tokens.id_token
          ? String(tokens.id_token).substring(0, 30) + '...'
          : 'N/A',
      }
    );

    // Step 2: Fetch user information using the access token (or id_token can be decoded directly for basic info)
    googleCallbackLogger.debug(
      `[${callId}] Fetching user information from Google's userinfo endpoint.`
    );
    const oauth2Service = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfoResponse = await oauth2Service.userinfo.get();
    const googleUserInfo = userInfoResponse.data; // Contains id, email, verified_email, name, given_name, family_name, picture, locale etc.

    if (!googleUserInfo || !googleUserInfo.id || !googleUserInfo.email) {
      googleCallbackLogger.error(
        `[${callId}] Failed to retrieve valid user information from Google after token exchange.`,
        { googleUserInfoResponse: googleUserInfo }
      );
      throw new DaitanOperationError(
        'Failed to retrieve valid user information from Google (missing id or email).'
      );
    }

    googleCallbackLogger.info(
      `[${callId}] Successfully retrieved user info from Google.`,
      {
        googleUserId: googleUserInfo.id,
        email: googleUserInfo.email,
        name: googleUserInfo.name,
        isVerified: googleUserInfo.verified_email,
      }
    );

    // At this point, the application would typically:
    // 1. Verify the id_token if it hasn't relied solely on userinfo endpoint (id_token provides verified email status).
    // 2. Find or create a user record in the application's database based on `googleUserInfo.id` or `googleUserInfo.email`.
    // 3. Generate an application-specific session token (e.g., a JWT).
    // 4. Redirect the user to a logged-in page or return the session token.
    // This library function returns the raw Google user info for the application to handle next steps.
    return new Response(JSON.stringify({ user: googleUserInfo }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    googleCallbackLogger.error(
      `[${callId}] Error during Google OAuth callback processing: ${error.message}`,
      {
        errorName: error.name,
        // stack: error.stack, // For debug environments
        isGoogleApiError: !!error.response?.data, // Google API client errors often have structure here
        googleApiErrorData: error.response?.data,
      }
    );

    let publicMessage = 'An error occurred during Google authentication.';
    let statusCode = 500; // Internal Server Error by default

    if (error.response && error.response.data && error.response.data.error) {
      // Specific error from Google's token or userinfo endpoint
      const googleError = error.response.data.error;
      const googleErrorDesc = error.response.data.error_description;
      publicMessage = `Google API error: ${googleErrorDesc || googleError}`;
      statusCode = error.response.status || 500; // Use Google's status if available

      if (googleError === 'invalid_grant') {
        // Common for invalid/expired code
        statusCode = 400; // Bad Request
        publicMessage =
          'Invalid or expired authorization code. Please try signing in again.';
      } else if (statusCode === 401) {
        // Unauthorized
        publicMessage =
          'Google authentication failed (unauthorized). Please check client configuration or try again.';
      }
    } else if (error instanceof DaitanConfigurationError) {
      publicMessage = `Server configuration error: ${error.message}`; // More specific for config issues
      statusCode = 500; // Server-side misconfiguration
    } else if (error instanceof DaitanOperationError) {
      publicMessage = `Operation error: ${error.message}`;
      statusCode = 502; // Bad Gateway, as we failed to get info from Google
    }
    // For other generic errors, keep default 500.

    return new Response(JSON.stringify({ error: publicMessage }), {
      status: statusCode,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

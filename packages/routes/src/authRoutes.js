// routes/src/authRoutes.js
/**
 * @file Reusable Next.js App Router route handlers for authentication.
 * @module @daitanjs/routes/authRoutes
 *
 * @description
 * This module provides pre-built, asynchronous functions designed to be used
 * as API route handlers in a Next.js App Router setup. They wrap the core
 * functionalities of the `@daitanjs/authentication` package, handling request
 * parsing and generating appropriate JSON responses.
 *
 * Each function is designed to be exported and used directly in a route file,
 * for example: `export { handleLogin as POST } from '@daitanjs/routes';`
 */
import { NextResponse } from 'next/server';
import {
  login as loginWithIdToken,
  signUp as signUpWithEmailPassword,
  googleLogin,
  googleCallBack,
} from '@daitanjs/authentication';
import { handleApiError, getJsonBody } from './helpers.js';

/**
 * Route handler for user login via Firebase ID token.
 * Expects a POST request with a JSON body: `{ "idToken": "..." }`.
 *
 * @param {import('next/server').NextRequest} req - The Next.js request object.
 * @returns {Promise<NextResponse>}
 */
export async function handleLogin(req) {
  if (req.method !== 'POST') {
    return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
  }
  try {
    const body = await req.json();
    // The `login` function in @daitanjs/authentication expects a generic request object.
    // We adapt the Next.js request to fit this generic interface.
    const genericRequest = {
      method: 'POST',
      text: async () => JSON.stringify(body),
    };
    // The service now returns a standard `Response` object, which we consume.
    const daitanResponse = await loginWithIdToken(genericRequest);
    const responseBody = await daitanResponse.json();
    return NextResponse.json(responseBody, { status: daitanResponse.status });
  } catch (error) {
    return handleApiError(error, 'login');
  }
}

/**
 * Route handler for user sign-up with email and password.
 * Expects a POST request with a JSON body: `{ "email": "...", "password": "..." }`.
 *
 * @param {import('next/server').NextRequest} req - The Next.js request object.
 * @returns {Promise<NextResponse>}
 */
export async function handleSignUp(req) {
  if (req.method !== 'POST') {
    return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
  }
  try {
    const body = await req.json();
    const genericRequest = {
      method: 'POST',
      headers: req.headers, // Pass headers through for content-type checks
      text: async () => JSON.stringify(body),
    };
    const daitanResponse = await signUpWithEmailPassword(genericRequest);
    const responseBody = await daitanResponse.json();
    return NextResponse.json(responseBody, { status: daitanResponse.status });
  } catch (error) {
    return handleApiError(error, 'signup');
  }
}

/**
 * Route handler for server-side processing of a Google OAuth callback.
 * Expects a GET request with a `code` query parameter from Google.
 *
 * @param {import('next/server').NextRequest} req - The Next.js request object.
 * @returns {Promise<NextResponse>}
 */
export async function handleGoogleCallback(req) {
  if (req.method !== 'GET') {
    return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
  }
  try {
    // The `googleCallBack` function expects a request-like object with `url` and `headers`.
    // The Next.js request object is compatible enough.
    const daitanResponse = await googleCallBack(req);
    const responseBody = await daitanResponse.json();

    const url = req.nextUrl.clone();
    url.search = ''; // Clear query params for the redirect

    if (daitanResponse.ok && responseBody.user) {
      // SUCCESS: In a real app, you would now find/create a local user,
      // generate a session token (JWT), and set it as a cookie in the response.
      // For now, we just redirect to a success page.
      url.pathname = '/dashboard';
      url.searchParams.set('login_success', 'true');
      return NextResponse.redirect(url);
    } else {
      // ERROR: Redirect to a login/error page with the error message.
      url.pathname = '/login';
      url.searchParams.set(
        'error',
        responseBody.error || 'Google authentication failed.'
      );
      return NextResponse.redirect(url);
    }
  } catch (error) {
    return handleApiError(error, 'google-callback');
  }
}

/**
 * Route handler for logging in a user via a Google ID token from the client.
 * Expects a POST request with JSON body: `{ "idToken": "..." }`.
 *
 * @param {import('next/server').NextRequest} req - The Next.js request object.
 * @returns {Promise<NextResponse>}
 */
export async function handleGoogleLogin(req) {
  if (req.method !== 'POST') {
    return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
  }
  try {
    const { idToken } = await getJsonBody(req);
    // `googleLogin` returns a success/user object or throws a DaitanError
    const result = await googleLogin({ idToken });
    return createSuccessResponse(result);
  } catch (error) {
    return handleApiError(error, 'google-login');
  }
}

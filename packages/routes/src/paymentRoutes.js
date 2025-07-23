// routes/src/paymentRoutes.js
/**
 * @file Reusable Next.js App Router route handlers for payment processing with Stripe.
 * @module @daitanjs/routes/paymentRoutes
 *
 * @description
 * This module provides the essential server-side endpoints for interacting with Stripe.
 * The primary handler creates a Payment Intent, which is the first step in any
 * payment flow. This keeps the Stripe secret key secure on the server.
 */

import { createPaymentIntent as createStripePaymentIntent } from '@daitanjs/payments';
import {
  handleApiError,
  createSuccessResponse,
  getJsonBody,
} from './helpers.js';
import { withAuth } from '@daitanjs/middleware';

/**
 * Route handler for creating a Stripe Payment Intent.
 * Expects a POST request with a JSON body: `{ "amount": number, "currency": "string", ... }`.
 * The amount should be in the smallest currency unit (e.g., cents).
 *
 * @param {import('next/server').NextRequest} req - The Next.js request object.
 * @returns {Promise<import('next/server').NextResponse>}
 */
async function createPaymentIntentHandler(req) {
  try {
    const payload = await getJsonBody(req);

    // The `createStripePaymentIntent` service function now expects a single object.
    // The payload from the request body can be passed directly.
    const paymentIntent = await createStripePaymentIntent(payload);

    // The most important piece of information for the client is the `client_secret`.
    // The client-side Stripe.js library uses this to securely confirm the payment.
    return createSuccessResponse({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
    });
  } catch (error) {
    // The `handleApiError` helper will correctly handle DaitanPaymentError
    // and other error types to return an appropriate status code and message.
    return handleApiError(error, 'createPaymentIntent');
  }
}

// Creating a payment intent should always be an authenticated action to associate
// the payment with a user and prevent anonymous users from hitting your Stripe API.
export const handleCreatePaymentIntent = withAuth(createPaymentIntentHandler);

// payments/src/index.js
/**
 * @file Main entry point for the @daitanjs/payments package.
 * @module @daitanjs/payments
 *
 * @description
 * This package provides functionalities for processing payments, with an initial
 * focus on Stripe integration. It aims to simplify common payment operations like
 * creating Payment Intents.
 *
 * Key Features:
 * - Stripe Payment Intent creation.
 * - Secure handling of API keys via `@daitanjs/config` (ConfigManager).
 * - Consistent error handling using DaitanJS custom error types.
 * - Integrated logging through `@daitanjs/development`.
 *
 * Future enhancements may include support for other payment gateways (e.g., PayPal, Braintree),
 * additional Stripe features (subscriptions, customer management, webhooks), and more.
 */

import { getLogger } from '@daitanjs/development';

const paymentsIndexLogger = getLogger('daitan-payments-index');

paymentsIndexLogger.debug(
  'Exporting DaitanJS Payments module functionalities...'
);

// --- Stripe Specific Functionalities ---
// All functions related to Stripe are exported from the `stripe.js` module.
// JSDoc for these functions can be found in `src/stripe.js`.
export { createPaymentIntent } from './stripe.js';
// Potential future Stripe exports:
// export { confirmPaymentIntent, retrievePaymentIntent, createStripeCustomer } from './stripe.js';

// --- Placeholder for Future Payment Providers ---
// If other payment providers (e.g., PayPal, Braintree) are added,
// their respective modules and functions would be exported here.
//
// Example:
// export * from './paypal.js'; // If PayPal support was added
// export { createBraintreeTransaction } from './braintree.js'; // If Braintree support was added

paymentsIndexLogger.info('DaitanJS Payments module exports ready.');

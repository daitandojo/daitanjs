// payments/src/stripe.js
/**
 * @file Stripe payment processing utilities.
 * @module @daitanjs/payments/stripe
 *
 * @description
 * This module provides functions to interact with the Stripe API, primarily for creating
 * Payment Intents. It handles Stripe SDK initialization, API key management (via ConfigManager),
 * and wraps Stripe API responses and errors in DaitanJS-consistent structures.
 *
 * Configuration:
 * - `STRIPE_SECRET_KEY`: Required Stripe secret key.
 */
import Stripe from 'stripe';
import { getLogger } from '@daitanjs/development';
import { getConfigManager } from '@daitanjs/config';
import {
  DaitanConfigurationError,
  DaitanInvalidInputError,
  DaitanPaymentError,
} from '@daitanjs/error';

const logger = getLogger('daitan-payments-stripe');


const stripeInstanceCache = new Map();
const DEFAULT_STRIPE_API_VERSION = '2024-04-10';

/** @private */
const getStripeInstance = (explicitStripeSecretKey) => {
  const configManager = getConfigManager();
  
  const stripeSecretKey =
    explicitStripeSecretKey || configManager.get('STRIPE_SECRET_KEY');

  if (
    !stripeSecretKey ||
    typeof stripeSecretKey !== 'string' ||
    !stripeSecretKey.trim().startsWith('sk_')
  ) {
    throw new DaitanConfigurationError(
      'Stripe secret key is missing, invalid, or not in the expected format. Configure STRIPE_SECRET_KEY environment variable.'
    );
  }

  if (stripeInstanceCache.has(stripeSecretKey)) {
    return stripeInstanceCache.get(stripeSecretKey);
  }

  try {
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: DEFAULT_STRIPE_API_VERSION,
      appInfo: {
        name: '@daitanjs/payments',
        version: '1.0.1',
        url: 'https://github.com/daitandojo/@daitanjs/tree/main/packages/payments',
      },
    });
    stripeInstanceCache.set(stripeSecretKey, stripe);
    logger.info(
      `New Stripe instance initialized successfully. API Version: ${DEFAULT_STRIPE_API_VERSION}.`
    );
    return stripe;
  } catch (error) {
    throw new DaitanConfigurationError(
      `Stripe SDK initialization failed: ${error.message}`,
      {},
      error
    );
  }
};

/**
 * Creates a Stripe Payment Intent.
 * @public
 * @async
 * @param {object} params - Parameters for creating the Payment Intent.
 * @returns {Promise<Stripe.PaymentIntent>} The created Stripe PaymentIntent object.
 */
export async function createPaymentIntent({
  amount,
  currency,
  stripeCustomerId,
  paymentMethodId,
  paymentMethodTypes = ['card'],
  metadata = {},
  description,
  captureMethod = 'automatic',
  confirm = false,
  receiptEmail,
  statementDescriptor,
  statementDescriptorSuffix,
  stripeAccount,
  stripeSecretKey,
  ...otherStripeOptions
}) {
  const callId = `stripePI-${Date.now().toString(36)}`;
  logger.info(`[${callId}] createPaymentIntent: Initiated.`, {
    amount,
    currency,
  });

  if (typeof amount !== 'number' || !Number.isInteger(amount) || amount <= 0) {
    throw new DaitanInvalidInputError(
      'Payment `amount` must be a positive integer in the smallest currency unit.'
    );
  }
  if (
    !currency ||
    typeof currency !== 'string' ||
    currency.trim().length !== 3
  ) {
    throw new DaitanInvalidInputError(
      'Payment `currency` must be a 3-letter ISO code.'
    );
  }

  const stripe = getStripeInstance(stripeSecretKey);

  const createParams = {
    amount,
    currency: currency.toLowerCase(),
    payment_method_types: paymentMethodTypes,
    capture_method: captureMethod,
    metadata,
    ...(stripeCustomerId && { customer: stripeCustomerId }),
    ...(paymentMethodId && { payment_method: paymentMethodId }),
    ...(confirm && { confirm: true }),
    ...(description && { description }),
    ...(receiptEmail && { receipt_email: receiptEmail }),
    ...(statementDescriptor && { statement_descriptor: statementDescriptor }),
    ...(statementDescriptorSuffix && {
      statement_descriptor_suffix: statementDescriptorSuffix,
    }),
    ...otherStripeOptions,
  };

  const requestOptions = {};
  if (stripeAccount) {
    requestOptions.stripeAccount = stripeAccount;
  }

  logger.debug(`[${callId}] Creating Stripe PaymentIntent with params:`, {
    apiParams: { amount: createParams.amount, currency: createParams.currency },
    requestOptions,
  });

  try {
    const paymentIntent = await stripe.paymentIntents.create(
      createParams,
      requestOptions
    );
    logger.info(
      `[${callId}] Stripe PaymentIntent created successfully. ID: ${paymentIntent.id}`
    );
    return paymentIntent;
  } catch (error) {
    const stripeErrorMessage = error.message || 'Unknown Stripe API error.';
    const stripeErrorCode = error.code;
    const stripeErrorType = error.type;
    const httpStatusCode = error.statusCode;

    logger.error(
      `[${callId}] Error creating Stripe PaymentIntent: ${stripeErrorMessage}`
    );

    throw new DaitanPaymentError(
      `Stripe PaymentIntent creation failed: ${stripeErrorMessage}`,
      {
        apiName: 'Stripe',
        httpStatusCode,
        gatewayErrorCode: stripeErrorCode,
        stripeErrorType,
        stripeRawError: error.raw,
        failedParameter: error.param,
      },
      error
    );
  }
}

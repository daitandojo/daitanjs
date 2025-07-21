// intelligence/src/intelligence/tools/createPaymentIntentTool.js
/**
 * @file A DaitanJS tool for creating Stripe Payment Intents.
 * @module @daitanjs/intelligence/tools/createPaymentIntentTool
 *
 * @description
 * This module exports a LangChain-compatible tool that allows an AI agent to
 * initiate a payment process by creating a Stripe Payment Intent. It securely
 * wraps the `createPaymentIntent` function from the `@daitanjs/payments` package,
 * ensuring that sensitive operations remain on the server side. The tool uses
 * Zod for rigorous input validation.
 */

import { createDaitanTool } from '../core/toolFactory.js'; // CORRECTED: Import from the new 'core' location
import { z } from 'zod';
import { createPaymentIntent } from '@daitanjs/payments';

const CreatePaymentIntentInputSchema = z
  .object({
    amount: z
      .number()
      .int()
      .positive(
        'Amount must be a positive integer in the smallest currency unit (e.g., cents).'
      ),
    currency: z
      .string()
      .length(3, 'Currency must be a 3-letter ISO code.')
      .toLowerCase(),
    description: z
      .string()
      .optional()
      .describe('An optional description for the payment.'),
    metadata: z
      .record(z.string())
      .optional()
      .describe('Optional key-value metadata for the payment.'),
  })
  .strict();

export const createPaymentIntentTool = createDaitanTool(
  'create_payment_intent',
  `Initiates a payment by creating a Stripe Payment Intent. This is the first step in processing a credit card payment.
The input must be an object with:
- "amount" (integer): The amount in the smallest currency unit (e.g., 1000 for $10.00).
- "currency" (string): The 3-letter ISO currency code (e.g., "usd").
- "description" (string, optional): A description for the payment that may appear on the user's statement.
- "metadata" (object, optional): Key-value pairs for internal tracking.
This tool returns a summary including the 'client_secret' which is essential for a front-end application to securely finalize the payment.`,
  async (input) => {
    const validatedInput = CreatePaymentIntentInputSchema.parse(input);

    const paymentIntent = await createPaymentIntent({
      amount: validatedInput.amount,
      currency: validatedInput.currency,
      description: validatedInput.description,
      metadata: validatedInput.metadata,
    });

    // Only return the necessary client-side information to the LLM.
    const result = {
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      status: paymentIntent.status,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
    };

    return `Payment Intent created successfully. The client_secret is available to pass to the front-end for payment confirmation. Details: ${JSON.stringify(
      result
    )}`;
  },
  CreatePaymentIntentInputSchema
);

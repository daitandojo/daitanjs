// communication/src/index.js
/**
 * @file Main entry point for the @daitanjs/communication package.
 * @module @daitanjs/communication
 *
 * @description
 * This package provides a suite of utilities for handling communications, including
 * email and SMS/WhatsApp messaging. It abstracts away the complexities of different
 * providers and integrates with a background job queue for reliable, asynchronous delivery.
 *
 * Key Features:
 * - **Email**:
 *   - `sendMail`: Queues an email for sending via a configured SMTP provider.
 *   - `sendTemplatedEmail`: A high-level function to send pre-defined, styled emails
 *     (e.g., welcome, password reset) using HTML templates.
 * - **SMS & WhatsApp**:
 *   - `sendSMS` / `sendWhatsapp`: Functions for sending messages via Twilio.
 *   - `createMessageTemplate`, `composeMessageFromTemplate`: Utilities for creating
 *     and using message templates with placeholders.
 * - **General**:
 *   - `replacePlaceholders`: A utility re-exported for convenience in message composition.
 */
import { getLogger } from '@daitanjs/development';
import { replacePlaceholders } from '@daitanjs/utilities';

const communicationIndexLogger = getLogger('daitan-communication-index');

communicationIndexLogger.debug('Exporting DaitanJS Communication modules...');

// --- Email Functionalities ---
export { sendMail } from './email/nodemailer.js';
export { sendTemplatedEmail } from './email/templatedMailer.js';

// --- SMS & WhatsApp Functionalities ---
export {
  sendSMS,
  sendWhatsapp,
  createMessageTemplate,
  composeMessageFromTemplate,
} from './sms/twilio.js';

// --- General Utilities ---
// Re-exported from @daitanjs/utilities for convenience within this package's context.
export { replacePlaceholders };

communicationIndexLogger.info('DaitanJS Communication module exports ready.');

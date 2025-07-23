// src/communication/src/sms/index.js
/**
 * @file Re-exports SMS and WhatsApp functionalities, primarily from the Twilio module.
 * @module @daitanjs/communication/sms
 *
 * @description
 * This index file serves as the public interface for SMS and WhatsApp messaging
 * operations within the `@daitanjs/communication` package. It exports core sending
 * functions and templating utilities from the `twilio.js` submodule.
 *
 * If other SMS/WhatsApp providers were to be added (e.g., Vonage, MessageBird),
 * their functionalities would also be exported from here, potentially under
 * a unified interface or as provider-specific exports.
 */
import { getLogger } from '@daitanjs/development';
import { replacePlaceholders as canonicalReplacePlaceholders } from '@daitanjs/utilities';

const smsIndexLogger = getLogger('daitan-comm-sms-index');

smsIndexLogger.debug('Exporting DaitanJS SMS & WhatsApp functionalities...');

// --- Core Sending Functions (from twilio.js) ---
// JSDoc for these is in `src/sms/twilio.js`.
export { sendSMS, sendWhatsapp } from './twilio.js';

// --- Templating Utilities (from twilio.js and utilities) ---
// These allow applications to compose messages programmatically using pre-defined templates
// without necessarily sending them immediately via this library.
// JSDoc for these is in `src/sms/twilio.js`.
export { createMessageTemplate, composeMessageFromTemplate } from './twilio.js';

// Re-export the canonical placeholder replacer for convenience.
export const replacePlaceholders = canonicalReplacePlaceholders;

smsIndexLogger.info('DaitanJS SMS & WhatsApp module exports ready.');

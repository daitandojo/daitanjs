// src/communication/src/sms/twilio.js
/**
 * @file SMS and WhatsApp sending functionalities using Twilio.
 * @module @daitanjs/communication/sms/twilio
 */
import twilio from 'twilio';
import { getLogger } from '@daitanjs/development';
import { getConfigManager } from '@daitanjs/config';
import { replacePlaceholders } from '@daitanjs/utilities';
import {
  DaitanConfigurationError,
  DaitanApiError,
  DaitanInvalidInputError,
} from '@daitanjs/error';

const smsLogger = getLogger('daitan-comm-twilio');
let twilioClientInstance = null;

/** @private */
const getTwilioClient = () => {
  if (twilioClientInstance) {
    return twilioClientInstance;
  }
  const configManager = getConfigManager(); // Lazy-load the config manager
  const accountSid = configManager.get('TWILIO_ACCOUNTSID');
  const authToken = configManager.get('TWILIO_AUTHTOKEN');

  if (!accountSid || !authToken) {
    throw new DaitanConfigurationError(
      'Twilio Account SID and Auth Token must be configured in environment variables (TWILIO_ACCOUNTSID, TWILIO_AUTHTOKEN).'
    );
  }
  twilioClientInstance = twilio(accountSid, authToken);
  smsLogger.info('Twilio client initialized successfully.');
  return twilioClientInstance;
};

/**
 * Sends an SMS message using Twilio.
 * @public
 * @async
 * @param {object} params
 * @param {string} params.recipient - The recipient phone number in E.164 format.
 * @param {string} params.messageBody - The text content of the message.
 * @param {string} [params.from] - Optional: A specific Twilio sender number to use.
 * @returns {Promise<string>} The Twilio Message SID.
 */
export async function sendSMS({ recipient, messageBody, from }) {
  if (!recipient || !/^\+?[1-9]\d{1,14}$/.test(recipient)) {
    throw new DaitanInvalidInputError(
      'Invalid recipient phone number. Must be in E.164 format.'
    );
  }
  if (!messageBody || typeof messageBody !== 'string' || !messageBody.trim()) {
    throw new DaitanInvalidInputError('Message body cannot be empty.');
  }
  const client = getTwilioClient();
  const fromNumber = from || getConfigManager().get('TWILIO_SENDER'); // Lazy-load here too
  if (!fromNumber) {
    throw new DaitanConfigurationError(
      'Twilio sender number (TWILIO_SENDER) is not configured.'
    );
  }

  try {
    const message = await client.messages.create({
      to: recipient,
      from: fromNumber,
      body: messageBody,
    });
    smsLogger.info(
      `SMS sent successfully to ${recipient}. SID: ${message.sid}`
    );
    return message.sid;
  } catch (error) {
    smsLogger.error(`Failed to send SMS to ${recipient}: ${error.message}`);
    throw new DaitanApiError(
      `Twilio API error: ${error.message}`,
      'Twilio',
      error.status,
      { apiErrorCode: error.code },
      error
    );
  }
}

/**
 * Sends a WhatsApp message using Twilio.
 * @public
 * @async
 * @param {object} params
 * @param {string} params.recipient - The recipient phone number in E.164 format.
 * @param {string} params.messageBody - The text content of the message.
 * @param {string} [params.from] - Optional: A specific Twilio WhatsApp sender ID.
 * @returns {Promise<string>} The Twilio Message SID.
 */
export async function sendWhatsapp({ recipient, messageBody, from }) {
  if (!recipient || !/^\+?[1-9]\d{1,14}$/.test(recipient)) {
    throw new DaitanInvalidInputError(
      'Invalid recipient phone number. Must be in E.164 format.'
    );
  }
  if (!messageBody || typeof messageBody !== 'string' || !messageBody.trim()) {
    throw new DaitanInvalidInputError('Message body cannot be empty.');
  }
  const client = getTwilioClient();
  const fromNumber = from || getConfigManager().get('TWILIO_WHATSAPP_SENDER'); // Lazy-load here too
  if (!fromNumber) {
    throw new DaitanConfigurationError(
      'Twilio WhatsApp sender ID (TWILIO_WHATSAPP_SENDER) is not configured.'
    );
  }

  try {
    const message = await client.messages.create({
      to: `whatsapp:${recipient}`,
      from: fromNumber.startsWith('whatsapp:')
        ? fromNumber
        : `whatsapp:${fromNumber}`,
      body: messageBody,
    });
    smsLogger.info(
      `WhatsApp message sent successfully to ${recipient}. SID: ${message.sid}`
    );
    return message.sid;
  } catch (error) {
    smsLogger.error(
      `Failed to send WhatsApp message to ${recipient}: ${error.message}`
    );
    throw new DaitanApiError(
      `Twilio WhatsApp API error: ${error.message}`,
      'Twilio',
      error.status,
      { apiErrorCode: error.code },
      error
    );
  }
}

/**
 * Creates a template function for composing messages with placeholders.
 * @public
 * @param {string} templateString - The template string with {{placeholder}} syntax.
 * @returns {(placeholders: object) => string} A function that takes a placeholder object and returns the composed message.
 */
export const createMessageTemplate = (templateString) => {
  return (placeholders) =>
    replacePlaceholders({ templateString, placeholders });
};

/**
 * Composes a message from a template function and placeholder values.
 * @public
 * @param {(placeholders: object) => string} templateFn - A function created by `createMessageTemplate`.
 * @param {object} placeholders - An object with key-value pairs for the placeholders.
 * @returns {string} The composed message.
 */
export const composeMessageFromTemplate = (templateFn, placeholders) => {
  if (typeof templateFn !== 'function') {
    throw new DaitanInvalidInputError(
      'templateFn must be a function created with createMessageTemplate.'
    );
  }
  return templateFn(placeholders);
};

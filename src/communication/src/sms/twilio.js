/**
 * @module TwilioMessenger
 * @description A module for sending WhatsApp and SMS messages using Twilio, with template support.
 */

import twilio from 'twilio';
import { replacePlaceholders } from '../composer/index';

const accountSid = process.env.TWILIO_ACCOUNTSID;
const authToken = process.env.TWILIO_AUTHTOKEN;
const client = twilio(accountSid, authToken);

/**
 * @typedef {Object} MessageTemplate
 * @property {Object.<string, string>} body - The message body in different languages.
 * @property {Object.<string, string>} placeholders - Default placeholders for the template.
 */

const templates = new Map();

/**
 * Creates and stores a new message template.
 * @param {string} name - The name of the template.
 * @param {MessageTemplate} template - The message template object.
 */
const createTemplate = (name, template) => {
  templates.set(name, template);
};

/**
 * Composes a message based on a template and provided replacements.
 * @param {Object} options - The options for composing the message.
 * @param {string} options.templateName - The name of the template to use.
 * @param {string} options.language - The language to use for the message.
 * @param {Object.<string, string>} [options.replacements] - Values to replace placeholders.
 * @returns {string} The composed message body.
 * @throws {Error} If there's an error in composing the message.
 */
const composeMessage = ({ templateName, language, replacements = {} }) => {
  const template = templates.get(templateName);
  if (!template) {
    throw new Error(`Template '${templateName}' not found`);
  }

  const bodyTemplate = template.body[language];
  if (!bodyTemplate) {
    throw new Error(
      `Language '${language}' not found in template '${templateName}'`,
    );
  }

  const mergedReplacements = { ...template.placeholders, ...replacements };
  return replacePlaceholders({
    template: bodyTemplate,
    placeholders: mergedReplacements,
  });
};

/**
 * Sends a WhatsApp message.
 * @param {Object} options - The options for sending the WhatsApp message.
 * @param {string} options.recipient - The recipient's phone number.
 * @param {string} options.templateName - The name of the template to use.
 * @param {string} options.language - The language to use for the message.
 * @param {Object.<string, string>} [options.replacements] - Values to replace placeholders.
 * @returns {Promise<string>} A promise that resolves to the message SID.
 */
const sendWhatsapp = async ({
  recipient,
  templateName,
  language,
  replacements,
}) => {
  const body = composeMessage({
    templateName,
    language,
    replacements,
  });
  try {
    const message = await client.messages.create({
      body: body,
      from: 'whatsapp:' + process.env.TWILIO_SENDER,
      to: 'whatsapp:' + recipient,
    });
    console.log(`Successfully sent WhatsApp (${message.sid})`);
    return message.sid;
  } catch (error) {
    console.error('Error sending WhatsApp:', error);
    throw error;
  }
};

/**composer
 * Sends an SMS message.
 * @param {Object} options - The options for sending the SMS message.
 * @param {string} options.recipient - The recipient's phone number.
 * @param {string} options.templateName - The name of the template to use.
 * @param {string} options.language - The language to use for the message.
 * @param {Object.<string, string>} [options.replacements] - Values to replace placeholders.
 * @returns {Promise<string>} A promise that resolves to the message SID.
 */
const sendSMS = async ({ recipient, templateName, language, replacements }) => {
  const body = composeMessage({ templateName, language, replacements });
  console.log(`Sending SMS to ${recipient}`);
  console.log(`BODY: ${body}`);

  try {
    const message = await client.messages.create({
      body: body,
      to: recipient,
      from: process.env.TWILIO_SENDER,
    });
    console.log(`Successfully sent SMS (${message.sid})`);
    return message.sid;
  } catch (error) {
    console.error('Error sending SMS:', error);
    throw error;
  }
};

export { sendWhatsapp, sendSMS };

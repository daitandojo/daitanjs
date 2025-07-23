// communication/src/email/templatedMailer.js
/**
 * @file High-level function for sending pre-defined, templated emails.
 * @module @daitanjs/communication/email/templatedMailer
 *
 * @description
 * This module provides the `sendTemplatedEmail` function, which simplifies sending
 * common types of transactional emails (e.g., welcome, password reset) by abstracting
 * away the HTML generation and assembly process.
 */
import { getLogger } from '@daitanjs/development';
import {
  createEmailWrapper,
  createEmailHeader,
  createEmailFooter,
  createHeading,
  createParagraph,
  createButton,
  createAlert,
} from '@daitanjs/html';
import { sendMail } from './nodemailer.js';
import {
  DaitanConfigurationError,
  DaitanInvalidInputError,
} from '@daitanjs/error';

const templatedMailerLogger = getLogger('daitan-templated-mailer');

/**
 * @typedef {Object} WelcomeTemplateData
 * @property {string} name - The recipient's name.
 * @property {string} activationLink - The URL for account activation.
 * @property {string} [companyName] - The name of the company/app sending the email.
 */

/**
 * @typedef {Object} PasswordResetTemplateData
 * @property {string} name - The recipient's name.
 * @property {string} resetLink - The URL for the password reset form.
 * @property {string} [companyName] - The name of the company/app.
 */

/**
 * @typedef {Object} GenericNotificationTemplateData
 * @property {string} name - The recipient's name.
 * @property {string} notificationMessage - The main content of the notification.
 * @property {string} [actionLink] - Optional URL for a call-to-action button.
 * @property {string} [actionText] - Text for the call-to-action button.
 * @property {'info'|'success'|'warning'|'error'} [alertType] - Optional type for an alert box.
 * @property {string} [companyName] - The name of the company/app.
 */

/**
 * @typedef {Object} SendTemplatedEmailParams
 * @property {string} to - The recipient's email address.
 * @property {string} subject - The subject line of the email.
 * @property {'welcome' | 'passwordReset' | 'notification'} templateName - The name of the email template to use.
 * @property {WelcomeTemplateData | PasswordResetTemplateData | GenericNotificationTemplateData} templateData - An object containing the data to populate the template.
 * @property {import('./nodemailer.js').NodemailerMailerConfig} [mailerConfig] - Optional mailer configuration to override defaults.
 */

const generateWelcomeEmailBody = (data) => {
  const heading = createHeading({ text: `Welcome, ${data.name}!`, level: 1 });
  const p1 = createParagraph({
    text: `We're thrilled to have you on board. We're confident that our platform will help you achieve your goals.`,
  });
  const p2 = createParagraph({
    text: `To get started, please click the button below to activate your account:`,
  });
  const button = createButton({
    text: 'Activate Your Account',
    href: data.activationLink,
  });
  return `${heading}${p1}${p2}<br>${button}`;
};

const generatePasswordResetEmailBody = (data) => {
  const heading = createHeading({ text: `Reset Your Password`, level: 1 });
  const p1 = createParagraph({
    text: `Hi ${data.name}, a password reset was requested for your account.`,
  });
  const p2 = createParagraph({
    text: `If you did not request this, you can safely ignore this email. Otherwise, click the button below to set a new password:`,
  });
  const button = createButton({ text: 'Reset Password', href: data.resetLink });
  const p3 = createParagraph({
    text: `This link is valid for 1 hour.`,
    fontSize: 12,
    color: '#888888',
  });
  return `${heading}${p1}${p2}<br>${button}<br>${p3}`;
};

const generateNotificationEmailBody = (data) => {
  let content = createHeading({
    text: `Notification for ${data.name}`,
    level: 2,
  });
  if (data.alertType) {
    content += createAlert({
      message: data.notificationMessage,
      type: data.alertType,
    });
  } else {
    content += createParagraph({ text: data.notificationMessage });
  }
  if (data.actionLink && data.actionText) {
    content += `<br>${createButton({
      text: data.actionText,
      href: data.actionLink,
    })}`;
  }
  return content;
};

const templates = {
  welcome: generateWelcomeEmailBody,
  passwordReset: generatePasswordResetEmailBody,
  notification: generateNotificationEmailBody,
};

/**
 * Sends a pre-defined, templated email.
 * @public
 * @async
 * @param {SendTemplatedEmailParams} params - The parameters for the templated email.
 * @returns {Promise<import('bullmq').Job>} The BullMQ Job object that was created.
 */
export const sendTemplatedEmail = async ({
  to,
  subject,
  templateName,
  templateData,
  mailerConfig = {},
}) => {
  const callId = `templated-email-${templateName}-${Date.now().toString(36)}`;
  templatedMailerLogger.info(`[${callId}] Preparing to send templated email.`, {
    to,
    templateName,
  });

  if (!to || !subject || !templateName || !templateData) {
    throw new DaitanInvalidInputError(
      'Missing required parameters: `to`, `subject`, `templateName`, and `templateData` are all required.'
    );
  }

  const templateGenerator = templates[templateName];
  if (!templateGenerator) {
    throw new DaitanConfigurationError(
      `Email template "${templateName}" not found. Available templates: ${Object.keys(
        templates
      ).join(', ')}`
    );
  }

  const bodyContent = templateGenerator(templateData);
  const header = createEmailHeader({ title: subject });
  const footer = createEmailFooter({
    companyName: templateData.companyName || 'DaitanJS Platform',
    address: '123 Innovation Drive, Tech City, 12345',
  });

  const fullHtmlBody = `<div style="padding: 20px;">${header}${bodyContent}${footer}</div>`;
  const finalHtml = createEmailWrapper({
    bodyContent: fullHtmlBody,
    config: {
      title: subject,
      previewText:
        typeof bodyContent === 'string'
          ? bodyContent.substring(0, 100)
          : 'Notification',
    },
  });

  return sendMail({
    message: { to, subject, html: finalHtml },
    config: mailerConfig,
  });
};

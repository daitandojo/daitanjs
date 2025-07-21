// packages/communication/src/email/nodemailer.js
/**
 * @file Email sending functionalities using Nodemailer, offloaded to a queue.
 * @module @daitanjs/communication/email/nodemailer
 */
import { getLogger, getOptionalEnvVariable } from '@daitanjs/development';
import { getConfigManager } from '@daitanjs/config';
import { addJob } from '@daitanjs/queues';
import {
  DaitanConfigurationError,
  DaitanOperationError,
  DaitanInvalidInputError,
} from '@daitanjs/error';

const emailLogger = getLogger('daitan-comm-email-queuer');
const EMAIL_QUEUE_NAME = 'mail-queue';
const SEND_EMAIL_JOB_NAME = 'send-email-via-nodemailer';

/**
 * @typedef {Object} NodemailerMailerConfig
 * @property {string} [host] - SMTP server host.
 * @property {number} [port] - SMTP server port.
 * @property {boolean} [secure] - Whether to use SSL/TLS.
 * @property {object} [auth] - Authentication object.
 * @property {string} [auth.user] - SMTP username.
 * @property {string} [auth.pass] - SMTP password.
 * @property {string} [fromName] - Default sender name for emails.
 * @property {string} [fromAddress] - Default sender email address.
 * @property {boolean} [tlsRejectUnauthorized] - Override for `MAIL_TLS_REJECT_UNAUTHORIZED`.
 */

/**
 * @typedef {Object} EmailMessage
 * @property {string | string[]} to - Recipient email address(es).
 * @property {string} subject - Email subject line.
 * @property {string} html - HTML content of the email.
 * @property {string} [text] - Optional plain text version.
 * @property {string} [from] - Sender email address.
 * @property {string} [name] - Sender name.
 * @property {string | string[]} [cc] - CC recipient(s).
 * @property {string | string[]} [bcc] - BCC recipient(s).
 * @property {Array<import('nodemailer/lib/mailer').Attachment>} [attachments] - Array of attachment objects.
 * @property {string | string[]} [replyTo] - Optional Reply-To address(es).
 * @property {object} [headers] - Optional custom headers.
 */

/**
 * @typedef {Object} SendMailParams
 * @property {EmailMessage} message - The email message details.
 * @property {NodemailerMailerConfig} [config={}] - Optional mailer configuration for this send operation.
 */

/**
 * Validates email parameters and adds a job to the `mail-queue` for background processing.
 *
 * @public
 * @async
 * @param {SendMailParams} params - The consolidated parameters object.
 * @returns {Promise<import('bullmq').Job>} The BullMQ Job object that was created.
 * @throws {DaitanInvalidInputError} If essential `message` fields are missing or invalid.
 * @throws {DaitanOperationError} If adding the job to the queue fails.
 */
export const sendMail = async ({ message, config = {} }) => {
  const configManager = getConfigManager(); // Lazy-load the config manager
  const callId = `mail-queue-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .substring(2, 7)}`;
  emailLogger.info(
    `[${callId}] sendMail: Queuing email. Subject: "${String(
      message?.subject
    ).substring(0, 50)}..."`,
    { to: message?.to }
  );

  if (!message || typeof message !== 'object') {
    throw new DaitanInvalidInputError(
      '`message` object must be a non-null object.'
    );
  }
  const missingFields = [];
  if (
    !message.to ||
    (Array.isArray(message.to) && message.to.length === 0) ||
    (typeof message.to === 'string' && !message.to.trim())
  )
    missingFields.push('to');
  if (!message.subject || !String(message.subject).trim())
    missingFields.push('subject');
  if (!message.html || !String(message.html).trim()) missingFields.push('html');
  if (missingFields.length > 0) {
    throw new DaitanInvalidInputError(
      `Email message missing required field(s): ${missingFields.join(', ')}.`,
      { missingFields }
    );
  }

  // This object contains the full SMTP configuration needed by the worker.
  const finalSmtpConfig = {
    host: config.host || configManager.get('SMTP_HOST'),
    port: Number(config.port ?? configManager.get('SMTP_PORT', 587)),
    auth: {
      user: config.auth?.user || configManager.get('SMTP_USER'),
      pass: config.auth?.pass || configManager.get('SMTP_PASS'),
    },
    tls: {
      rejectUnauthorized:
        config.tlsRejectUnauthorized ??
        getOptionalEnvVariable('MAIL_TLS_REJECT_UNAUTHORIZED', 'false', {
          type: 'boolean',
        }) === true,
    },
  };
  finalSmtpConfig.secure =
    config.secure !== undefined ? config.secure : finalSmtpConfig.port === 465;

  let senderName =
    message.name ||
    config.fromName ||
    configManager.get('SMTP_FROM_NAME') ||
    'DaitanJS App';
  let fromEmailAddress =
    message.from ||
    config.fromAddress ||
    configManager.get('SMTP_FROM_ADDRESS') ||
    finalSmtpConfig.auth.user;

  const fromRegex = /^(.*?)<([^>]+)>$/;
  const fromMatch =
    typeof message.from === 'string' ? message.from.match(fromRegex) : null;
  if (fromMatch) {
    senderName = fromMatch[1].trim() || senderName;
    fromEmailAddress = fromMatch[2].trim();
  } else if (typeof message.from === 'string') {
    fromEmailAddress = message.from.trim();
  }

  const finalFromHeader = senderName
    ? `"${senderName.replace(/"/g, '\\"')}" <${fromEmailAddress}>`
    : fromEmailAddress;

  let finalToRecipients = Array.isArray(message.to) ? message.to : [message.to];
  const recipientOverride = configManager.get('MAIL_RECIPIENT_OVERRIDE');

  // The development override logic is correctly placed here.
  if (configManager.get('NODE_ENV') === 'development' && recipientOverride) {
    emailLogger.warn(
      `[${callId}] DEV MODE: Email recipients overridden to "${recipientOverride}".`
    );
    finalToRecipients = [recipientOverride.trim()];
    message.cc = [];
    message.bcc = [];
  }

  // This is the full payload for the email itself.
  const mailOptions = {
    from: finalFromHeader,
    to: finalToRecipients.join(', '),
    subject: message.subject,
    html: message.html,
    ...(message.text && { text: message.text }),
    ...(message.cc &&
      Array.isArray(message.cc) &&
      message.cc.length > 0 && { cc: message.cc.join(', ') }),
    ...(message.bcc &&
      Array.isArray(message.bcc) &&
      message.bcc.length > 0 && { bcc: message.bcc.join(', ') }),
    ...(message.attachments && { attachments: message.attachments }),
    ...(message.replyTo && { replyTo: message.replyTo }),
    ...(message.headers && { headers: message.headers }),
  };

  // The job data contains everything the worker needs to send the email.
  const jobData = { mailOptions, smtpConfig: finalSmtpConfig, callId };
  emailLogger.debug(
    `[${callId}] Preparing to add email job to queue "${EMAIL_QUEUE_NAME}".`
  );

  try {
    const job = await addJob(EMAIL_QUEUE_NAME, SEND_EMAIL_JOB_NAME, jobData, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });
    emailLogger.info(
      `[${callId}] Email job successfully added to queue "${EMAIL_QUEUE_NAME}" with Job ID: ${job.id}.`
    );
    return job;
  } catch (queueError) {
    throw new DaitanOperationError(
      `Failed to queue email for sending: ${queueError.message}`,
      { to: message.to },
      queueError
    );
  }
};

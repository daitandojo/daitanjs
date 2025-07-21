// workers/emailWorker.js
/**
 * @file DaitanJS Email Queue Worker
 * @description This worker process listens to the 'mail-queue' and sends emails
 * using Nodemailer based on the job data. This file should be run as a separate
 * Node.js process.
 *
 * To run this worker:
 * `node workers/emailWorker.js`
 *
 * It's essential that the environment variables required for DaitanJS libraries
 * (especially for logging, config, and Redis) are available to this process.
 * You can use a `.env` file and `dotenv` or set them directly.
 */

// We need to initialize the environment and config manager for this standalone process.
import 'dotenv/config'; // Loads .env file into process.env at the start
import { initializeConfigManager } from '@daitanjs/config';
import { loadEnvironmentFiles } from '@daitanjs/development';
import { createWorker } from '@daitanjs/queues';
import nodemailer from 'nodemailer';
import { getLogger } from '@daitanjs/development';
import {
  DaitanOperationError,
  DaitanConfigurationError,
} from '@daitanjs/error';

// --- Initialization ---
loadEnvironmentFiles(); // Load .env files according to DaitanJS standard
initializeConfigManager(); // Initialize the config manager with loaded env vars

const workerLogger = getLogger('daitan-email-worker');
const EMAIL_QUEUE_NAME = 'mail-queue';
const SEND_EMAIL_JOB_NAME = 'send-email-via-nodemailer';

workerLogger.info(`Starting email worker for queue: "${EMAIL_QUEUE_NAME}"...`);

/**
 * Creates a Nodemailer transporter.
 * This function is duplicated from the original sendMail module for use in the worker.
 * In a real application, this could be shared in a common internal utility.
 * @param {object} smtpConfig - SMTP configuration.
 * @param {string} callId - For logging.
 */
const createTransporter = (smtpConfig, callId) => {
  if (
    !smtpConfig ||
    !smtpConfig.host ||
    !smtpConfig.auth?.user ||
    !smtpConfig.auth?.pass
  ) {
    const missing = [];
    if (!smtpConfig.host) missing.push('host');
    if (!smtpConfig.auth?.user) missing.push('auth.user');
    if (!smtpConfig.auth?.pass) missing.push('auth.pass');
    throw new DaitanConfigurationError(
      `Worker: SMTP configuration for job is incomplete. Missing: ${missing.join(
        ', '
      )}.`
    );
  }

  const transporterOptions = {
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: smtpConfig.secure,
    auth: smtpConfig.auth,
    tls: {
      rejectUnauthorized: smtpConfig.tlsRejectUnauthorized,
    },
  };
  workerLogger.debug(`[${callId}] Worker: Creating Nodemailer transporter.`, {
    host: transporterOptions.host,
    user: transporterOptions.auth.user,
  });
  return nodemailer.createTransport(transporterOptions);
};

/**
 * The main job processing function.
 * @param {import('bullmq').Job} job - The job object from the queue.
 */
const processEmailJob = async (job) => {
  const { mailOptions, smtpConfig, callId } = job.data;
  const logContext = {
    jobId: job.id,
    jobName: job.name,
    originalCallId: callId,
  };

  workerLogger.info(`[${callId}] Worker: Processing email job...`, logContext);

  if (!mailOptions || !smtpConfig) {
    throw new DaitanConfigurationError(
      'Job data is missing required `mailOptions` or `smtpConfig`.',
      logContext
    );
  }

  try {
    const transporter = createTransporter(smtpConfig, callId);
    workerLogger.debug(
      `[${callId}] Worker: Transporter created. Sending mail...`,
      logContext
    );
    const info = await transporter.sendMail(mailOptions);
    workerLogger.info(`[${callId}] Worker: Email sent successfully.`, {
      ...logContext,
      messageId: info.messageId,
      response: info.response,
    });
    return {
      messageId: info.messageId,
      response: info.response,
    };
  } catch (error) {
    workerLogger.error(
      `[${callId}] Worker: Error sending email: ${error.message}`,
      {
        ...logContext,
        errorMessage: error.message,
        smtpErrorCode: error.code,
        smtpResponseCode: error.responseCode,
      }
    );
    // Let BullMQ handle the retry based on the job options by re-throwing the error
    throw new DaitanOperationError(
      `Worker failed to send email: ${error.message}`,
      logContext,
      error
    );
  }
};

// --- Create and run the worker ---
const worker = createWorker(EMAIL_QUEUE_NAME, processEmailJob, {
  concurrency: 5, // Process up to 5 emails concurrently
  limiter: {
    max: 100, // Max 100 jobs
    duration: 60000, // per 60 seconds
  },
});

workerLogger.info(
  `Worker for "${EMAIL_QUEUE_NAME}" is running and waiting for jobs.`
);

// --- Graceful Shutdown ---
const shutdown = async () => {
  workerLogger.info('Shutting down email worker...');
  await worker.close();
  // If the Redis connection is managed globally, close it here too.
  // The @daitanjs/queues package could export a `closeAllConnections` function for this.
  workerLogger.info('Email worker shut down gracefully.');
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

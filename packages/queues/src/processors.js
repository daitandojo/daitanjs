// packages/queues/src/processors.js
/**
 * @file Defines the logic for processing different types of jobs.
 * @module @daitanjs/queues/processors
 */
import nodemailer from 'nodemailer';
import { getLogger } from '@daitanjs/development';
import { DaitanInvalidInputError } from '@daitanjs/error';

const processorLogger = getLogger('daitan-queues-processors');

/**
 * Processor for jobs that send emails using Nodemailer.
 * The job's data is expected to contain `mailOptions` and `smtpConfig`.
 * @param {import('bullmq').Job} job - The job object from BullMQ.
 */
async function emailJobProcessor(job) {
  const { mailOptions, smtpConfig } = job.data;
  const processLogger = processorLogger.child({
    jobId: job.id,
    callId: job.data.callId,
  });

  processLogger.info(`Processing job "${job.name}"...`, {
    to: mailOptions.to,
    subject: mailOptions.subject,
  });

  if (!mailOptions || !smtpConfig?.auth?.user || !smtpConfig?.auth?.pass) {
    throw new DaitanInvalidInputError(
      'Job data is missing mailOptions or valid smtpConfig.'
    );
  }

  const transporter = nodemailer.createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: smtpConfig.secure,
    auth: {
      user: smtpConfig.auth.user,
      pass: smtpConfig.auth.pass,
    },
    tls: {
      rejectUnauthorized: smtpConfig.tlsRejectUnauthorized === true,
    },
  });

  processLogger.info(`Sending email to ${mailOptions.to}...`);
  const info = await transporter.sendMail(mailOptions);
  processLogger.info('Email sent successfully!', {
    messageId: info.messageId,
    response: info.response,
  });

  return { success: true, messageId: info.messageId };
}

/**
 * A map of queue names to their corresponding job processor functions.
 * The generic worker will use this map to start the correct workers.
 */
export const jobProcessors = new Map([
  // The key is the QUEUE NAME.
  // The value is an object mapping JOB NAMES within that queue to processor functions.
  [
    'mail-queue',
    {
      'send-email-via-nodemailer': emailJobProcessor,
      // You could add other email job types here, e.g., 'send-bulk-email'
    },
  ],

  // Example for the future:
  // ['image-processing-queue', {
  //   'compress-image': imageCompressionProcessor,
  //   'generate-thumbnail': thumbnailProcessor,
  // }],
]);

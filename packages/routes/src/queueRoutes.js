// routes/src/queueRoutes.js
/**
 * @file Reusable Next.js App Router route handler for interacting with job queues.
 * @module @daitanjs/routes/queueRoutes
 *
 * @description
 * This module provides API endpoints to check the status of background jobs
 * managed by the `@daitanjs/queues` package.
 */

import { createQueue } from '@daitanjs/queues';
import { handleApiError, createSuccessResponse } from './helpers.js';
import { withAuth } from '@daitanjs/middleware';
import { DaitanNotFoundError, DaitanInvalidInputError } from '@daitanjs/error';

/**
 * Route handler for checking the status of a specific job in a queue.
 * Expects a GET request with query parameters: `?queueName=...&jobId=...`.
 *
 * @param {import('next/server').NextRequest} req - The Next.js request object.
 * @returns {Promise<import('next/server').NextResponse>}
 */
async function getJobStatusHandler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const queueName = searchParams.get('queueName');
    const jobId = searchParams.get('jobId');

    if (!queueName || !jobId) {
      throw new DaitanInvalidInputError(
        'Both "queueName" and "jobId" query parameters are required.'
      );
    }

    const queue = createQueue(queueName); // createQueue still takes a single string argument.
    const job = await queue.getJob(jobId);

    if (!job) {
      throw new DaitanNotFoundError(
        `Job with ID "${jobId}" not found in queue "${queueName}".`
      );
    }

    const jobState = await job.getState();

    // Return a selection of useful, non-sensitive job properties.
    const jobDetails = {
      id: job.id,
      name: job.name,
      data: job.data, // Be cautious about returning sensitive data
      state: jobState,
      isCompleted: await job.isCompleted(),
      isFailed: await job.isFailed(),
      failedReason: job.failedReason,
      returnValue: job.returnvalue,
      progress: job.progress,
      timestamp: job.timestamp,
      finishedOn: job.finishedon,
    };

    return createSuccessResponse(jobDetails);
  } catch (error) {
    return handleApiError(error, 'getJobStatus');
  }
}

// Checking a job status should be an authenticated action, as job data can be sensitive.
export const handleGetJobStatus = withAuth(getJobStatusHandler);

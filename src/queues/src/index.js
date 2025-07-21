// File: src/queues/src/index.js
import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { getLogger } from '@daitanjs/development';
import { getConfigManager } from '@daitanjs/config';
import {
  DaitanConfigurationError,
  DaitanInvalidInputError,
  DaitanOperationError,
} from '@daitanjs/error';
import { jobProcessors } from './processors.js';

const logger = getLogger('daitan-queues');

let redisConnectionInstance = null;
const queueInstances = new Map();
let heartbeatInterval = null; // To hold the heartbeat interval timer

const getRedisConnection = () => {
  const configManager = getConfigManager();
  if (redisConnectionInstance && redisConnectionInstance.status === 'ready') {
    return redisConnectionInstance;
  }

  const redisUrl = configManager.get('REDIS_URL');
  const redisOptions = {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  };

  try {
    if (
      redisUrl &&
      (redisUrl.startsWith('redis://') || redisUrl.startsWith('rediss://'))
    ) {
      logger.info('Creating new Redis connection for BullMQ using REDIS_URL.');
      if (redisUrl.startsWith('rediss://')) {
        redisOptions.tls = {};
      }
      redisConnectionInstance = new IORedis(redisUrl, redisOptions);
    } else {
      const redisHost = configManager.get('REDIS_HOST', 'localhost');
      const redisPort = configManager.get('REDIS_PORT', 6379);
      const redisPassword = configManager.get('REDIS_PASSWORD');
      logger.info(
        'REDIS_URL not found or invalid, falling back to REDIS_HOST/PORT configuration.',
        {
          host: redisHost,
          port: redisPort,
        }
      );
      redisConnectionInstance = new IORedis({
        host: redisHost,
        port: redisPort,
        password: redisPassword,
        ...redisOptions,
      });
    }

    redisConnectionInstance.on('error', (err) => {
      logger.error('Redis connection error.', { errorMessage: err.message });
    });

    return redisConnectionInstance;
  } catch (error) {
    logger.error('Failed to instantiate IORedis client.', {
      errorMessage: error.message,
    });
    throw new DaitanConfigurationError(
      `Failed to create Redis connection: ${error.message}`,
      {},
      error
    );
  }
};

export const createQueue = (queueName, options = {}) => {
  if (!queueName || typeof queueName !== 'string' || !queueName.trim()) {
    throw new DaitanInvalidInputError('Queue name must be a non-empty string.');
  }
  const trimmedQueueName = queueName.trim();
  if (queueInstances.has(trimmedQueueName)) {
    return queueInstances.get(trimmedQueueName);
  }
  const redisConnection = getRedisConnection();
  const queue = new Queue(trimmedQueueName, {
    connection: redisConnection,
    ...options,
  });
  queueInstances.set(trimmedQueueName, queue);
  return queue;
};

export const createWorker = (queueName, processor, options = {}) => {
  if (!queueName || typeof queueName !== 'string' || !queueName.trim()) {
    throw new DaitanInvalidInputError(
      'Queue name must be a non-empty string for worker creation.'
    );
  }
  if (typeof processor !== 'function') {
    throw new DaitanInvalidInputError('Job processor must be a function.');
  }
  const trimmedQueueName = queueName.trim();
  const redisConnection = getRedisConnection();
  const worker = new Worker(trimmedQueueName, processor, {
    connection: redisConnection,
    ...options,
  });
  worker.on('completed', (job, result) => {
    logger.info(
      `Job ${job.id} (${job.name}) in queue "${trimmedQueueName}" completed successfully.`
    );
  });
  worker.on('failed', (job, err) => {
    logger.error(
      `Job ${job?.id} (${job?.name}) in queue "${trimmedQueueName}" failed.`,
      {
        errorMessage: err.message,
      }
    );
  });
  return worker;
};

export const addJob = async (queueName, jobName, data, options = {}) => {
  if (!jobName || typeof jobName !== 'string' || !jobName.trim()) {
    throw new DaitanInvalidInputError('Job name must be a non-empty string.');
  }
  try {
    const queue = createQueue(queueName);
    const job = await queue.add(jobName, data, options);
    return job;
  } catch (error) {
    logger.error(`Failed to add job "${jobName}" to queue "${queueName}".`, {
      errorMessage: error.message,
    });
    throw new DaitanOperationError(
      `Failed to add job to queue: ${error.message}`,
      {
        queueName,
        jobName,
      },
      error
    );
  }
};

/**
 * Checks if a specific worker is alive by checking for its heartbeat key in Redis.
 * @public
 * @async
 * @param {string} queueName - The name of the queue the worker is supposed to be listening to.
 * @returns {Promise<boolean>} True if the worker is alive, false otherwise.
 */
export const checkWorkerHealth = async (queueName) => {
  if (!queueName) {
    throw new DaitanInvalidInputError(
      'A queueName is required to check worker health.'
    );
  }
  try {
    // --- DEFINITIVE FIX: Check for the heartbeat key ---
    const redis = getRedisConnection();
    const key = `daitanjs:worker:status:${queueName}`;
    const result = await redis.exists(key);

    if (result === 1) {
      logger.debug(
        `Health check for queue "${queueName}": PASSED. Heartbeat key found.`
      );
      return true;
    } else {
      logger.warn(
        `Health check for queue "${queueName}": FAILED. No heartbeat key found.`
      );
      return false;
    }
  } catch (error) {
    logger.error('Failed to check worker health due to Redis error.', {
      queueName,
      error: error.message,
    });
    return false;
  }
};

/**
 * Initializes and starts all registered job workers.
 * @public
 * @async
 * @param {object} [options={}]
 * @param {string} [options.specificQueue] - Optional: Start a worker for only a specific queue.
 */
export const startWorkers = async (options = {}) => {
  logger.info('🚀 Starting DaitanJS Worker process...');
  const workers = [];
  const activeQueues = [];

  for (const [queueName, processors] of jobProcessors.entries()) {
    if (options.specificQueue && options.specificQueue !== queueName) {
      continue;
    }

    activeQueues.push(queueName);
    logger.info(`Starting worker for queue: "${queueName}"`);

    const masterProcessor = async (job) => {
      const jobProcessor = processors[job.name];
      if (jobProcessor) {
        logger.info(`Processing job "${job.name}" with ID ${job.id}`);
        return jobProcessor(job);
      } else {
        logger.error(
          `No processor found for job name "${job.name}" in queue "${queueName}".`
        );
        throw new Error(`Unknown job name: ${job.name}`);
      }
    };

    const worker = createWorker(queueName, masterProcessor);
    workers.push(worker);
  }

  if (workers.length === 0) {
    logger.error(
      `No workers started. Check queue name specified or jobProcessors map.`
    );
    return;
  }

  // --- DEFINITIVE FIX: HEARTBEAT LOGIC ---
  const sendHeartbeat = async () => {
    try {
      const redis = getRedisConnection();
      const timestamp = new Date().toISOString();
      for (const queueName of activeQueues) {
        const key = `daitanjs:worker:status:${queueName}`;
        // Set the key with an expiration of 65 seconds.
        // This is longer than the interval, ensuring it stays alive as long as the worker runs.
        await redis.set(key, timestamp, 'EX', 65);
      }
    } catch (err) {
      logger.error('Failed to send worker heartbeat to Redis.', {
        error: err.message,
      });
    }
  };

  // Clear any previous interval and start a new one
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  await sendHeartbeat(); // Send initial heartbeat immediately
  heartbeatInterval = setInterval(sendHeartbeat, 30000); // Send heartbeat every 30 seconds
  logger.info('Worker heartbeat mechanism started.');
  // --- END HEARTBEAT LOGIC ---

  logger.info(
    `✅ All specified workers are running. Waiting for jobs... (Press Ctrl+C to stop)`
  );

  const shutdown = async () => {
    logger.warn('Shutting down all workers...');
    if (heartbeatInterval) clearInterval(heartbeatInterval); // Stop the heartbeat
    // Also remove the heartbeat key on graceful shutdown
    try {
      const redis = getRedisConnection();
      for (const queueName of activeQueues) {
        await redis.del(`daitanjs:worker:status:${queueName}`);
      }
    } catch (err) {
      logger.warn('Could not clear heartbeat key on shutdown.', {
        error: err.message,
      });
    }

    await Promise.all(workers.map((w) => w.close()));
    logger.info('All workers closed. Exiting.');
    setTimeout(() => process.exit(0), 500);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  return new Promise(() => {});
};

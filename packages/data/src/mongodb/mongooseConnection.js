// data/src/mongodb/mongooseConnection.js
/**
 * @file Manages the Mongoose default connection, including event handling and retry logic.
 * @module @daitanjs/data/mongodb/mongooseConnection
 *
 * @description
 * This module provides functions to connect to, disconnect from, and manage the lifecycle
 * of the default Mongoose connection. It is designed to be robust, handling connection
 * retries with exponential backoff and ensuring graceful shutdown.
 *
 * Key Features:
 * - `connectToMongoose`: Establishes or retrieves the active Mongoose connection. Manages a singleton.
 * - `disconnectFromMongoose`: Closes the Mongoose connection.
 * - `getMongooseDefaultConnection`, `getMongooseDefaultReadyState`: Getters for the connection object and its state.
 * - Automatic connection retries on disconnection.
 * - Graceful shutdown on process signals (SIGINT, SIGTERM).
 *
 * Configuration for the MongoDB URI (`MONGO_URI`) and Mongoose options (`MONGOOSE_CONNECT_OPTIONS`)
 * is managed via `@daitanjs/config` (ConfigManager).
 */
import mongoose from 'mongoose';
import { getLogger } from '@daitanjs/development';
import { getConfigManager } from '@daitanjs/config';
import {
  DaitanConfigurationError,
  DaitanOperationError,
} from '@daitanjs/error';

const mongooseConnectionLogger = getLogger('daitan-mongoose-conn');

// --- Default Connection Parameters ---
const DEFAULT_MONGOOSE_CONNECT_OPTIONS = {
  serverSelectionTimeoutMS: 15000,
  connectTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  heartbeatFrequencyMS: 10000,
  maxPoolSize: 10,
  minPoolSize: 0,
  retryWrites: true,
  retryReads: true,
};

const DEFAULT_CONNECTION_MANAGER_OPTIONS = {
  maxRetryAttempts: 5,
  retryDelayBaseMs: 3000,
};

// --- State Variables ---
let connectionAttemptCycle = 0;
let isConnectionRetryInProgress = false;
let areEventListenersAttached = false;
let isGracefulShutdownHandlerAttached = false;
let activeConnectionUri = null;

/**
 * Internal function to attempt a Mongoose connection.
 * @private
 */
async function attemptMongooseConnection(uri, mongooseOpts, logger) {
  const configManager = getConfigManager(); // Lazy-load
  const currentAttempt = connectionAttemptCycle + 1;
  logger.info(
    `Mongoose: Attempting connection (Cycle: ${currentAttempt}/${configManager.get(
      'MONGO_MAX_RETRY_ATTEMPTS',
      DEFAULT_CONNECTION_MANAGER_OPTIONS.maxRetryAttempts
    )})...`,
    {
      uriPreview: uri.substring(
        0,
        uri.indexOf('@') > 0 ? uri.indexOf('@') : 30
      ),
    }
  );

  if (
    mongoose.connection.readyState !== 0 &&
    mongoose.connection.readyState !== 3
  ) {
    logger.info(
      `Mongoose: Current readyState is ${mongoose.connection.readyState}. Attempting to disconnect before new connection.`
    );
    try {
      await mongoose.disconnect();
      logger.info(
        'Mongoose: Successfully closed previous Mongoose connection.'
      );
    } catch (disconnectError) {
      logger.warn(
        `Mongoose: Error disconnecting previous Mongoose connection: ${disconnectError.message}`
      );
    }
  }
  try {
    await mongoose.connect(uri, mongooseOpts);
  } catch (connectionError) {
    logger.error(
      `Mongoose: mongoose.connect() call failed during attempt ${currentAttempt}.`,
      { errorMessage: connectionError.message }
    );
    throw new DaitanOperationError(
      `Mongoose connection attempt ${currentAttempt} failed: ${connectionError.message}`,
      {},
      connectionError
    );
  }
}

/**
 * Schedules a retry attempt for Mongoose connection with exponential backoff.
 * @private
 */
function scheduleMongooseRetry(uri, mongooseOpts, managerOpts, logger) {
  const maxRetries = managerOpts.maxRetryAttempts;

  if (connectionAttemptCycle >= maxRetries) {
    logger.error(
      `Mongoose: Maximum connection retry attempts (${maxRetries}) reached. No further retries will be scheduled for URI: ${activeConnectionUri.substring(
        0,
        30
      )}...`
    );
    isConnectionRetryInProgress = false;
    return;
  }

  connectionAttemptCycle++;
  const delay =
    managerOpts.retryDelayBaseMs * Math.pow(2, connectionAttemptCycle - 1) +
    Math.floor(Math.random() * 1000); // Add jitter
  logger.info(
    `Mongoose: Scheduling connection retry ${connectionAttemptCycle}/${maxRetries} in ${
      delay / 1000
    }s...`
  );

  isConnectionRetryInProgress = true;
  setTimeout(async () => {
    if (mongoose.connection.readyState === 1) {
      logger.info(
        'Mongoose: Connection established before scheduled retry executed. Aborting retry.'
      );
      isConnectionRetryInProgress = false;
      connectionAttemptCycle = 0;
      return;
    }
    if (mongoose.connection.readyState === 2) {
      logger.info(
        'Mongoose: Connection attempt already in progress during scheduled retry. Skipping this retry attempt.'
      );
      return;
    }

    try {
      await attemptMongooseConnection(uri, mongooseOpts, logger);
    } catch (error) {
      isConnectionRetryInProgress = false;
      if (mongoose.connection.readyState === 0) {
        scheduleMongooseRetry(uri, mongooseOpts, managerOpts, logger);
      }
    }
  }, delay);
}

/**
 * Sets up Mongoose event listeners.
 * @private
 */
function setupMongooseEventListeners(uri, mongooseOpts, managerOpts, logger) {
  if (areEventListenersAttached) return;

  mongoose.connection.on('connected', () => {
    logger.info(
      `✅ Mongoose: Connected to MongoDB at ${mongoose.connection.host}:${mongoose.connection.port}/${mongoose.connection.name}.`
    );
    connectionAttemptCycle = 0;
    isConnectionRetryInProgress = false;
    activeConnectionUri = uri;
  });

  mongoose.connection.on('error', (error) => {
    logger.error('Mongoose: Connection error.', {
      errorMessage: error.message,
      errorName: error.name,
    });
    isConnectionRetryInProgress = false;
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('Mongoose: Disconnected from MongoDB.');
    if (!isConnectionRetryInProgress && activeConnectionUri) {
      if (connectionAttemptCycle === 0) {
        logger.info(
          'Mongoose: Was connected, now disconnected. Initiating retry sequence.'
        );
      }
      scheduleMongooseRetry(uri, mongooseOpts, managerOpts, logger);
    } else if (isConnectionRetryInProgress) {
      logger.debug(
        'Mongoose: Disconnected event received during an active retry cycle.'
      );
    } else {
      logger.info(
        'Mongoose: Disconnected, but no active URI was set or not currently retrying (e.g., manual disconnect).'
      );
    }
  });

  mongoose.connection.on('reconnected', () => {
    logger.info('Mongoose: Reconnected to MongoDB.');
    connectionAttemptCycle = 0;
    isConnectionRetryInProgress = false;
  });

  mongoose.connection.on('close', () => {
    logger.info('Mongoose: Connection closed.');
    isConnectionRetryInProgress = false;
    activeConnectionUri = null;
  });

  areEventListenersAttached = true;
  logger.info('Mongoose: Event listeners attached.');
}

/**
 * Sets up graceful shutdown for Mongoose connection.
 * @private
 */
function setupGracefulShutdown(logger) {
  if (isGracefulShutdownHandlerAttached) return;

  const gracefulShutdown = async (signal) => {
    logger.info(
      `Mongoose: ${signal} signal received. Closing MongoDB connection...`
    );
    isConnectionRetryInProgress = true;
    activeConnectionUri = null;
    try {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
        logger.info(
          'Mongoose: Connection closed successfully due to application shutdown.'
        );
      }
    } catch (e) {
      logger.error(
        `Mongoose: Error during graceful shutdown disconnection: ${e.message}`
      );
    } finally {
      process.exit(0);
    }
  };
  process.once('SIGINT', () => gracefulShutdown('SIGINT'));
  process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));

  isGracefulShutdownHandlerAttached = true;
  logger.info(
    'Mongoose: Graceful shutdown handlers (SIGINT, SIGTERM) attached.'
  );
}

/**
 * Connects to MongoDB using Mongoose. Manages a single default connection.
 *
 * @param {string} [uri] - MongoDB URI. Defaults to `MONGO_URI` from ConfigManager.
 * @param {object} [mongooseConnectOptionsOverrides={}] - Mongoose connection options to override defaults.
 * @param {object} [connectionManagerOptionsOverrides={}] - Options for connection manager (retries, delay).
 * @param {import('winston').Logger} [loggerInstance] - Optional logger instance.
 * @returns {Promise<mongoose.Connection>} The Mongoose connection object.
 * @throws {DaitanConfigurationError} If URI is not provided or found.
 * @throws {DaitanOperationError} If initial connection attempt fails critically.
 */
export async function connectToMongoose(
  uri,
  mongooseConnectOptionsOverrides = {},
  connectionManagerOptionsOverrides = {},
  loggerInstance
) {
  const logger = loggerInstance || mongooseConnectionLogger;
  const configManager = getConfigManager(); // Lazy-load

  const mongoUriToUse = uri || configManager.get('MONGO_URI');
  if (!mongoUriToUse) {
    const errMsg =
      'MongoDB URI not provided and MONGO_URI not found in configuration.';
    logger.error(errMsg);
    throw new DaitanConfigurationError(errMsg);
  }

  const effectiveMongooseOptions = {
    ...DEFAULT_MONGOOSE_CONNECT_OPTIONS,
    ...configManager.get('MONGOOSE_CONNECT_OPTIONS', {}),
    ...mongooseConnectOptionsOverrides,
  };
  if (effectiveMongooseOptions.autoIndex === undefined) {
    effectiveMongooseOptions.autoIndex =
      configManager.get('NODE_ENV', 'production') === 'development';
    logger.debug(
      `Mongoose autoIndex set to ${effectiveMongooseOptions.autoIndex} based on NODE_ENV.`
    );
  }

  const effectiveManagerOptions = {
    ...DEFAULT_CONNECTION_MANAGER_OPTIONS,
    maxRetryAttempts: configManager.get(
      'MONGO_MAX_RETRY_ATTEMPTS',
      DEFAULT_CONNECTION_MANAGER_OPTIONS.maxRetryAttempts
    ),
    retryDelayBaseMs: configManager.get(
      'MONGO_RETRY_DELAY_MS',
      DEFAULT_CONNECTION_MANAGER_OPTIONS.retryDelayBaseMs
    ),
    ...connectionManagerOptionsOverrides,
  };

  if (
    mongoose.connection.readyState === 1 &&
    activeConnectionUri === mongoUriToUse
  ) {
    logger.debug('Mongoose: Already connected to the requested MongoDB URI.');
    setupMongooseEventListeners(
      mongoUriToUse,
      effectiveMongooseOptions,
      effectiveManagerOptions,
      logger
    );
    setupGracefulShutdown(logger);
    return mongoose.connection;
  }

  if (mongoose.connection.readyState === 2 || isConnectionRetryInProgress) {
    if (activeConnectionUri && activeConnectionUri !== mongoUriToUse) {
      logger.warn(
        `Mongoose: Connection attempt in progress for a different URI (${activeConnectionUri.substring(
          0,
          30
        )}...). A new connection to ${mongoUriToUse.substring(
          0,
          30
        )}... will be attempted after potential disconnect.`
      );
    } else {
      logger.info(
        'Mongoose: Connection or retry attempt already in progress for the same URI. Awaiting current attempt.'
      );
      return mongoose.connection;
    }
  }

  setupMongooseEventListeners(
    mongoUriToUse,
    effectiveMongooseOptions,
    effectiveManagerOptions,
    logger
  );
  setupGracefulShutdown(logger);

  activeConnectionUri = mongoUriToUse;
  connectionAttemptCycle = 0;
  isConnectionRetryInProgress = false;

  logger.info('Mongoose: Initiating new connection sequence...', {
    uriPreview: mongoUriToUse.substring(
      0,
      mongoUriToUse.indexOf('@') > 0 ? mongoUriToUse.indexOf('@') : 30
    ),
  });
  try {
    await attemptMongooseConnection(
      mongoUriToUse,
      effectiveMongooseOptions,
      logger
    );
    return mongoose.connection;
  } catch (initialConnectionError) {
    if (initialConnectionError instanceof DaitanOperationError)
      throw initialConnectionError;
    throw new DaitanOperationError(
      `Mongoose: Initial connection attempt failed critically: ${initialConnectionError.message}`,
      { uriPreview: mongoUriToUse.substring(0, 30) },
      initialConnectionError
    );
  }
}

/**
 * Disconnects from MongoDB if a connection is active.
 * @param {object} [options={}]
 * @param {import('winston').Logger} [options.loggerInstance] - Optional logger.
 * @returns {Promise<void>}
 */
export async function disconnectFromMongoose(options = {}) {
  const logger = options.loggerInstance || mongooseConnectionLogger;
  logger.info('Mongoose: disconnectFromMongoose called...');

  isConnectionRetryInProgress = true;
  activeConnectionUri = null;

  if (
    mongoose.connection.readyState !== 0 &&
    mongoose.connection.readyState !== 3
  ) {
    try {
      await mongoose.disconnect();
      logger.info(
        'Mongoose: Successfully disconnected via disconnectFromMongoose.'
      );
    } catch (e) {
      logger.error(`Mongoose: Error during manual disconnection: ${e.message}`);
      throw new DaitanOperationError(
        `Mongoose disconnect error: ${e.message}`,
        {},
        e
      );
    }
  } else {
    logger.info(
      'Mongoose: Already disconnected or in the process of disconnecting.'
    );
  }
  isConnectionRetryInProgress = false;
  connectionAttemptCycle = 0;
}

/**
 * Gets the default Mongoose connection object.
 * @returns {mongoose.Connection}
 */
export function getMongooseDefaultConnection() {
  return mongoose.connection;
}

/**
 * Gets the readyState of the default Mongoose connection.
 * 0: disconnected, 1: connected, 2: connecting, 3: disconnecting, 99: uninitialized
 * @returns {number} Mongoose readyState.
 */
export function getMongooseDefaultReadyState() {
  return mongoose.connection.readyState;
}

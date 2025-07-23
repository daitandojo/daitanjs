// data/src/mongodb/nativeConnection.js
/**
 * @file Manages native MongoDB driver connections.
 * @module @daitanjs/data/mongodb/nativeConnection
 *
 * @description
 * This module provides functions to connect to, disconnect from, and retrieve a global
 * instance of the MongoDB native client (`MongoClient`). It aims to manage a singleton
 * client for a given URI, ensuring that concurrent connection attempts for the same URI
 * reuse an existing promise or connection.
 *
 * Configuration for the MongoDB URI and client options is primarily handled via
 * `@daitanjs/config` (ConfigManager), using environment variables like `MONGO_NATIVE_URI`
 * (or fallback to `MONGO_URI`) and `MONGO_NATIVE_CLIENT_OPTIONS`.
 *
 * Key Features:
 * - `connectNativeClient`: Establishes or retrieves an active `MongoClient`.
 * - `disconnectNativeClient`: Closes the global `MongoClient`.
 * - `getGlobalNativeClient`: Returns the current global `MongoClient` if connected.
 * - Event listeners for client lifecycle events (e.g., serverOpening, serverClosed, error).
 *
 * Error Handling:
 * Uses DaitanJS custom error types for consistent error reporting.
 */
import { MongoClient } from 'mongodb';
import { getLogger } from '@daitanjs/development';
import { getConfigManager } from '@daitanjs/config';
import {
  DaitanConfigurationError,
  DaitanOperationError,
  DaitanDatabaseError,
} from '@daitanjs/error';

const nativeConnLogger = getLogger('daitan-native-mongodb-conn');

/** @type {import('mongodb').MongoClientOptions} */
const DEFAULT_NATIVE_CLIENT_OPTIONS = {
  maxPoolSize: 20,
  serverSelectionTimeoutMS: 15000,
  connectTimeoutMS: 15000,
  socketTimeoutMS: 45000,
  retryWrites: true,
  retryReads: true,
  appName: 'DaitanJSAppNative',
};

let globalNativeClientInstance = null;
let nativeClientConnectionPromiseCache = null;
let currentNativeClientUriCache = null;

/**
 * Attaches standard event listeners to a MongoClient instance.
 * @private
 */
function _attachEventListenersToClient(
  client,
  uriContext,
  callIdPrefix,
  logger
) {
  const uriPreview = uriContext.substring(0, 30) + '...';
  client.on('serverOpening', (event) =>
    logger.debug(
      `[${callIdPrefix}] MongoClient Event (for ${uriPreview}): serverOpening`,
      { address: event.address }
    )
  );
  client.on('serverClosed', (event) =>
    logger.warn(
      `[${callIdPrefix}] MongoClient Event (for ${uriPreview}): serverClosed`,
      { address: event.address, reason: event.reason?.type }
    )
  );
  client.on('topologyOpening', () =>
    logger.debug(
      `[${callIdPrefix}] MongoClient Event (for ${uriPreview}): topologyOpening`
    )
  );
  client.on('topologyClosed', () => {
    logger.warn(
      `[${callIdPrefix}] MongoClient Event (for ${uriPreview}): topologyClosed.`
    );
    if (globalNativeClientInstance === client) {
      globalNativeClientInstance = null;
      currentNativeClientUriCache = null;
      nativeClientConnectionPromiseCache = null;
      logger.info(
        `[${callIdPrefix}] Global native client's topology closed for ${uriPreview}. Global references reset.`
      );
    }
  });
  client.on('error', (err) => {
    logger.error(
      `[${callIdPrefix}] MongoClient Global Instance Error (for ${uriPreview}):`,
      { errorMessage: err.message, errorName: err.name }
    );
    if (globalNativeClientInstance === client) {
      globalNativeClientInstance = null;
      currentNativeClientUriCache = null;
      nativeClientConnectionPromiseCache = null;
    }
  });
  client.on('close', () => {
    logger.info(
      `[${callIdPrefix}] MongoClient connection explicitly closed (event 'close') for ${uriPreview}.`
    );
    if (globalNativeClientInstance === client) {
      globalNativeClientInstance = null;
      currentNativeClientUriCache = null;
      nativeClientConnectionPromiseCache = null;
    }
  });
  logger.debug(
    `[${callIdPrefix}] Attached event listeners to MongoClient for ${uriPreview}.`
  );
}

/**
 * Internal helper to disconnect the global native client and clear related caches.
 * @private
 */
async function disconnectNativeClientInternal(
  logger,
  callIdSuffix,
  reason = 'unknown'
) {
  const closingPromise = nativeClientConnectionPromiseCache;
  nativeClientConnectionPromiseCache = null;
  const closingUri = currentNativeClientUriCache;
  currentNativeClientUriCache = null;

  if (closingPromise) {
    logger.debug(
      `[disconnect-${callIdSuffix}] Waiting for in-progress connection before closing client for URI: ${
        closingUri ? closingUri.substring(0, 30) + '...' : 'unknown'
      }`
    );
    try {
      await closingPromise;
    } catch (e) {
      logger.debug(
        `[disconnect-${callIdSuffix}] In-progress connection promise rejected as expected during disconnect: ${e.message}`
      );
    }
  }

  if (globalNativeClientInstance) {
    const clientToClose = globalNativeClientInstance;
    const uriBeingClosedPreview =
      clientToClose.options?.srvHost ||
      clientToClose.options?.hosts?.join(',') ||
      'unknown_host';
    logger.info(
      `[disconnect-${callIdSuffix}] Closing global MongoClient for ${uriBeingClosedPreview} (Reason: ${reason})...`
    );
    globalNativeClientInstance = null;

    try {
      await clientToClose.close();
      logger.info(
        `[disconnect-${callIdSuffix}] Global MongoClient for ${uriBeingClosedPreview} disconnected successfully.`
      );
    } catch (error) {
      logger.error(
        `[disconnect-${callIdSuffix}] Error during global MongoClient disconnect for ${uriBeingClosedPreview}: ${error.message}`
      );
    }
  } else {
    logger.info(
      `[disconnect-${callIdSuffix}] No active global MongoClient to disconnect (Reason: ${reason}).`
    );
  }
}

/**
 * Connects to MongoDB using the native MongoDB driver (`MongoClient`).
 * @public
 * @async
 * @param {string} [uri] - The MongoDB URI.
 * @param {import('mongodb').MongoClientOptions} [mongoClientOptionsOverrides={}] - Options to override defaults.
 * @param {object} [options={}] - Additional operational options.
 * @param {import('winston').Logger} [options.loggerInstance] - Optional logger instance.
 * @param {boolean} [options.forceReconnect=false] - Force closes any existing client.
 * @returns {Promise<MongoClient>} Resolves with the connected MongoClient instance.
 */
export async function connectNativeClient(
  uri,
  mongoClientOptionsOverrides = {},
  options = {}
) {
  const logger = options.loggerInstance || nativeConnLogger;
  const configManager = getConfigManager(); // Lazy-load
  const callId = `nativeConnect-${Date.now().toString(36)}`;

  const mongoUriToUse =
    uri ||
    configManager.get('MONGO_NATIVE_URI') ||
    configManager.get('MONGO_URI');

  if (!mongoUriToUse) {
    throw new DaitanConfigurationError(
      'MongoDB URI for native client is not configured.'
    );
  }
  const uriPreview =
    mongoUriToUse.substring(
      0,
      mongoUriToUse.indexOf('@') > 0 ? mongoUriToUse.indexOf('@') + 1 : 30
    ) + '...';

  if (
    globalNativeClientInstance &&
    globalNativeClientInstance.topology?.isConnected() &&
    currentNativeClientUriCache === mongoUriToUse &&
    !options.forceReconnect
  ) {
    logger.debug(
      `[${callId}] Reusing existing active MongoClient connection to ${uriPreview}.`
    );
    return globalNativeClientInstance;
  }

  if (
    nativeClientConnectionPromiseCache &&
    currentNativeClientUriCache === mongoUriToUse &&
    !options.forceReconnect
  ) {
    logger.debug(
      `[${callId}] Connection attempt already in progress for ${uriPreview}. Awaiting existing promise.`
    );
    return nativeClientConnectionPromiseCache;
  }

  if (
    globalNativeClientInstance &&
    (options.forceReconnect || currentNativeClientUriCache !== mongoUriToUse)
  ) {
    const reason = options.forceReconnect ? 'forceReconnect' : 'URI changed';
    await disconnectNativeClientInternal(logger, `${callId}-pre`, reason);
  }

  currentNativeClientUriCache = mongoUriToUse;
  nativeClientConnectionPromiseCache = (async () => {
    let newClient = null;
    try {
      const envOptionsString = configManager.get('MONGO_NATIVE_CLIENT_OPTIONS');
      let envOptions = {};
      if (envOptionsString) {
        try {
          envOptions = JSON.parse(envOptionsString);
        } catch (e) {
          logger.warn(
            `[${callId}] Failed to parse MONGO_NATIVE_CLIENT_OPTIONS as JSON. Using defaults.`
          );
        }
      }

      const effectiveClientOptions = {
        ...DEFAULT_NATIVE_CLIENT_OPTIONS,
        ...envOptions,
        ...mongoClientOptionsOverrides,
      };
      newClient = new MongoClient(mongoUriToUse, effectiveClientOptions);
      _attachEventListenersToClient(newClient, mongoUriToUse, callId, logger);

      await newClient.connect();
      globalNativeClientInstance = newClient;

      logger.info(
        `[${callId}] ✅ MongoClient connected successfully to ${uriPreview}.`
      );
      if (currentNativeClientUriCache === mongoUriToUse) {
        nativeClientConnectionPromiseCache = null;
      }
      return newClient;
    } catch (error) {
      logger.error(
        `[${callId}] ❌ Error connecting MongoClient to ${uriPreview}: ${error.message}`
      );
      if (currentNativeClientUriCache === mongoUriToUse) {
        nativeClientConnectionPromiseCache = null;
        currentNativeClientUriCache = null;
      }
      if (newClient) await newClient.close().catch(() => {});
      globalNativeClientInstance = null;
      throw new DaitanDatabaseError(
        `Failed to connect native MongoDB client to ${uriPreview}: ${error.message}`,
        { uriPreview, operation: 'connectNative' },
        error
      );
    }
  })();

  return nativeClientConnectionPromiseCache;
}

/**
 * Disconnects the global native MongoClient if it's active.
 * @public
 * @async
 * @param {object} [options={}]
 * @param {import('winston').Logger} [options.loggerInstance]
 * @returns {Promise<void>}
 */
export async function disconnectNativeClient(options = {}) {
  const logger = options.loggerInstance || nativeConnLogger;
  await disconnectNativeClientInternal(
    logger,
    `manual-${Date.now().toString(36)}`,
    'manualCallToDisconnect'
  );
}

/**
 * Returns the currently active global MongoClient instance if connected.
 * @public
 * @returns {MongoClient | null} The MongoClient instance or `null`.
 */
export function getGlobalNativeClient() {
  if (
    globalNativeClientInstance &&
    globalNativeClientInstance.topology?.isConnected()
  ) {
    return globalNativeClientInstance;
  }
  return null;
}

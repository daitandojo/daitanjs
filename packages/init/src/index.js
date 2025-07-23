// packages/init/src/index.js (version 1.0.5)
/**
 * @file Main entry point for the @daitanjs/init package.
 * @module @daitanjs/init
 */
// --- DEFINITIVE FIX: Load environment files FIRST, before any other DaitanJS imports ---
import { loadEnvironmentFiles } from '@daitanjs/development';

// Load environment variables immediately upon module import.
// This ensures that `process.env` is populated before any other
// DaitanJS module (like the logger or config manager) is initialized.
loadEnvironmentFiles({
  overrideDotenv: true,
  debugDotenv: process.env.DEBUG_DOTENV === 'true',
});

// Now, with process.env populated, we can safely import the rest of the modules.
import { getLogger } from '@daitanjs/development';
import { initializeConfigManager } from '@daitanjs/config';
import {
  connectToMongoose,
  getMongooseDefaultConnection,
} from '@daitanjs/data';
import { startWorkers, createQueue } from '@daitanjs/queues';
import { DaitanOperationError } from '@daitanjs/error';
import {
  checkOllamaStatus,
  checkChromaConnection,
} from '@daitanjs/intelligence';
import chalk from 'chalk';

/**
 * @typedef {Object} DaitanApp
 * @property {import('@daitanjs/config').DaitanConfigManagerClass} config
 * @property {import('winston').Logger} logger
 * @property {import('mongoose').Connection} [db]
 * @property {Object} healthStatus - Status of connected services.
 */

/**
 * @typedef {Object} InitializeAppOptions
 * @property {string} [appName='DaitanJSApp']
 * @property {Array<'database' | 'queues' | 'logging' | 'intelligence'>} [features=['logging']]
 * @property {string} [envPath] - A specific .env file path to load *in addition* to global/project defaults.
 * @property {boolean} [startQueueWorkers=false]
 * @property {boolean} [runHealthChecks=true] - Whether to run health checks on external services.
 * @property {boolean} [failOnUnhealthy=true] - If true, initialization will fail if any checked service is unhealthy.
 */

export const initializeDaitanApp = async ({
  appName = 'DaitanJSApp',
  features = ['logging'],
  envPath,
  startQueueWorkers = false,
  runHealthChecks = true,
  failOnUnhealthy = true,
} = {}) => {
  // If a specific envPath was passed to THIS function, we reload to give it precedence.
  // The initial load at the top of the file handles the global DAITAN_GLOBAL_ENV_PATH.
  if (envPath) {
    loadEnvironmentFiles({
      envPath,
      overrideDotenv: true,
      debugDotenv: process.env.DEBUG_DOTENV === 'true',
    });
  }

  let appLogger;
  try {
    // Now it's safe to get the logger, as its config is loaded.
    appLogger = getLogger(appName);
    appLogger.info('--- DaitanJS Application Initialization: START ---');

    // Initialize the config manager. It will now correctly read the fully populated process.env.
    // forceReload: true is important to ensure it re-reads if it was implicitly initialized somewhere else.
    appLogger.info('Initializing configuration manager...');
    const config = initializeConfigManager({
      loggerInstance: appLogger,
      forceReload: true,
    });

    const app = { config, logger: appLogger, healthStatus: {} };

    if (features.includes('database')) {
      appLogger.info('Connecting to database (Mongoose)...');
      await connectToMongoose();
      app.db = getMongooseDefaultConnection();
    }

    if (features.includes('queues')) {
      appLogger.info('Initializing job queues (Redis connection)...');
      createQueue('daitan-init-check'); // This ensures the Redis connection is attempted
    }

    if (runHealthChecks) {
      appLogger.info('Running health checks for external services...');
      const healthChecks = {
        Ollama: () => checkOllamaStatus(config.get('OLLAMA_BASE_URL')),
        ChromaDB: () => checkChromaConnection(),
        Redis: async () => {
          let queue;
          let redisClient;
          try {
            queue = createQueue('daitan-health-check-queue');
            redisClient = await queue.client;
            const pong = await redisClient.ping();
            await queue.close();
            return pong === 'PONG';
          } catch (e) {
            return false;
          } finally {
            if (redisClient) {
              await redisClient.quit().catch(() => {});
            }
            if (queue) {
              await queue.close().catch(() => {});
            }
          }
        },
      };

      const unhealthyServices = [];
      for (const [service, checkFn] of Object.entries(healthChecks)) {
        const isHealthy = await checkFn();
        app.healthStatus[service] = {
          ok: isHealthy,
          status: isHealthy ? '✅ Connected' : '❌ Disconnected',
        };
        appLogger.info(`  - ${service}: ${app.healthStatus[service].status}`);
        if (!isHealthy) {
          unhealthyServices.push(service);
        }
      }

      if (failOnUnhealthy && unhealthyServices.length > 0) {
        throw new DaitanOperationError(
          `Initialization failed due to unhealthy services: ${unhealthyServices.join(
            ', '
          )}. Check the connection to these services and try again.`
        );
      }
    }

    appLogger.info('--- DaitanJS Application Initialization: COMPLETE ---');

    if (startQueueWorkers && features.includes('queues')) {
      appLogger.info('Final Step: Starting background job workers...');
      await startWorkers();
    }

    return app;
  } catch (error) {
    // This dynamic import is a fallback in case the logger wasn't even initialized.
    const errorLogger =
      appLogger ||
      (await import('@daitanjs/development')).getLogger('daitan-init-error');
    errorLogger.error('FATAL: DaitanJS Application Initialization Failed.', {
      error,
    });

    if (
      error instanceof DaitanOperationError &&
      error.message.includes('unhealthy services')
    ) {
      console.error(chalk.red.bold('\n❌ Application Initialization Failed.'));
      console.error(
        chalk.yellow('   A required background service is not running.')
      );
      const serviceMatch = error.message.match(/unhealthy services: ([\w, ]+)/);
      if (serviceMatch && serviceMatch[1]) {
        console.error(
          chalk.yellow(
            `   Please start the following service(s): ${chalk.cyan(
              serviceMatch[1]
            )}`
          )
        );
      }
      console.log(chalk.dim('\nExiting application.'));
      process.exit(1);
    }
    throw error;
  }
};
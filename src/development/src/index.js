// development/src/index.js
/**
 * @file Main entry point for the @daitanjs/development package.
 * @module @daitanjs/development
 *
 * @description
 * The `@daitanjs/development` package provides a suite of utilities essential for
 * the development lifecycle of DaitanJS projects and applications built with DaitanJS.
 * It includes tools for environment variable management, a robust logging system,
 * hardware/system information retrieval, and general developer utilities.
 */
import { getLogger } from './logger.js';

const devIndexLogger = getLogger('daitan-development-index');

devIndexLogger.debug('Exporting DaitanJS Development utilities...');

// --- Environment Variable Management ---
export {
  loadEnvironmentFiles,
  getEnvVariable,
  checkEnv,
  getRequiredEnvVariable,
  getOptionalEnvVariable,
  // --- CORRECTED: Removed the exports for the deleted deprecated functions ---
  // initializeEnvironment, // Deprecated, exported for backward compatibility
  // configureEnv, // Deprecated, exported for backward compatibility
} from './environment.js';

// --- Logging System ---
export {
  getLogger,
  setGlobalLogLevel,
  isLogLevelEnabled,
  DaitanRootLogger,
  DAITAN_LOG_LEVELS,
} from './logger.js';

// --- Hardware & System Information ---
export {
  isTensorFlowSupported,
  getCPUInfo,
  getMemoryInfo,
  getNetworkInfo,
  getOSInfo,
  getLoadAverage,
  getGraphicsAndDisplayInfo,
  getUsbDevicesInfo,
  getAudioDevicesInfo,
  getAllHardwareInfo,
} from './hardware.js';

// --- General Developer Tools/Utilities (from tools.js) ---
export {
  devSimpleLog,
  devMultitestExample, // Deprecated placeholder
} from './tools.js';

// --- Google OAuth Client ---
export {
  getGoogleAuthClient,
  default as daitanDevGoogleOAuthClient,
} from './googleAuth.js';

devIndexLogger.info('DaitanJS Development utilities module exports ready.');

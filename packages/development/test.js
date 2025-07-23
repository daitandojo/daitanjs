import fs from 'fs';
import chalk from 'chalk';

// Assuming you are running this from the root of the @daitanjs/development package
// If running from a consuming app, change the import to '@daitanjs/development'
import {
  initializeRootLogger,
  getLogger,
  setGlobalLogLevel,
  loadEnvironmentFiles,
  getRequiredEnvVariable,
  getOptionalEnvVariable,
  getEnvVariable,
  getCPUInfo,
  getMemoryInfo,
  getNetworkInfo,
  getOSInfo,
  getLoadAverage,
  getAllHardwareInfo,
  isTensorFlowSupported,
  getGoogleAuthClient,
  devSimpleLog,
  devMultitestExample,
} from './src/index.js';

// --- CORRECTED HELPER FUNCTIONS ---
const log = (message, style = chalk.green) => console.log(style(message));
const logTitle = (title) => console.log(chalk.bold.yellow.inverse(`\n--- ${title} ---`));
const logObject = (obj) => console.dir(obj, { depth: 2, colors: true });

/**
 * Creates temporary .env files for testing.
 */
function setupTestEnvironment() {
  logTitle('Setting Up Test Environment');
  const envContent = `
# .env file
API_KEY=key_from_dotenv
DB_HOST=localhost
FEATURE_FLAG=true
USER_COUNT=100
ALLOWED_USERS=buck,jane,john
`;
  const envLocalContent = `
# .env.local file (should override .env)
API_KEY=key_from_dotenv_local
SECRET_MESSAGE=this is a secret
`;
  fs.writeFileSync('.env', envContent);
  fs.writeFileSync('.env.local', envLocalContent);
  log('Created .env and .env.local files for testing.');
}

/**
 * Removes the temporary .env files.
 */
function cleanupTestEnvironment() {
  logTitle('Cleaning Up Test Environment');
  try {
    fs.unlinkSync('.env');
    fs.unlinkSync('.env.local');
    log('Removed temporary .env files.');
  } catch (error) {
    console.error('Cleanup failed:', error.message);
  }
}

async function testLogger() {
  logTitle('Testing Logger');
  const internalLogger = getLogger('test-suite-internal');
  log('Attempting to log a debug message BEFORE initialization (default level is "info")...');
  internalLogger.debug('This message should NOT be visible.');

  log('Initializing root logger with level: "debug"');
  initializeRootLogger({ logLevel: 'debug', logPath: './test_logs' });

  log('Attempting to log a debug message AFTER initialization...');
  internalLogger.debug('This message SHOULD BE visible now. The logger was updated retroactively.');

  const appLogger = getLogger('my-app');
  appLogger.info('This is an info message from appLogger.');
  appLogger.warn('This is a warning message.');
  appLogger.error('This is an error message. It will also be in errors.log.');

  log('Setting global log level to "warn"...');
  setGlobalLogLevel('warn');
  appLogger.info('This INFO message should NOT be visible now.');
  appLogger.warn('This WARN message SHOULD still be visible.');
  log('Logger test complete. Check the console and the ./test_logs directory.');
}

async function testEnvironment() {
  logTitle('Testing Environment Variable Management');
  loadEnvironmentFiles({ debugDotenv: true });

  log('\n--- Testing Variable Retrieval ---');
  log(`API_KEY (overridden by .env.local): ${getRequiredEnvVariable('API_KEY')}`);
  log(`DB_HOST (from .env): ${getRequiredEnvVariable('DB_HOST')}`);
  log(`SECRET_MESSAGE (from .env.local): ${getRequiredEnvVariable('SECRET_MESSAGE')}`);
  log(`NON_EXISTENT_VAR (with default): ${getOptionalEnvVariable('NON_EXISTENT_VAR', 'default_value')}`);

  log('\n--- Testing Type Casting ---');
  const featureFlag = getEnvVariable('FEATURE_FLAG', null, { type: 'boolean' });
  const userCount = getEnvVariable('USER_COUNT', null, { type: 'number' });
  const allowedUsers = getEnvVariable('ALLOWED_USERS', null, { type: 'array' });
  log(`FEATURE_FLAG (as boolean): ${featureFlag} (type: ${typeof featureFlag})`);
  log(`USER_COUNT (as number): ${userCount} (type: ${typeof userCount})`);
  log('ALLOWED_USERS (as array):');
  logObject(allowedUsers);

  log('\n--- Testing Required Variable Failure ---');
  
  // --- FIX: Temporarily disable strict mode to ensure the function THROWS instead of EXITING ---
  const originalValidationMode = process.env.DAITAN_ENV_VALIDATION_MODE;
  if (originalValidationMode === 'strict') {
    delete process.env.DAITAN_ENV_VALIDATION_MODE;
    log('Temporarily disabled DAITAN_ENV_VALIDATION_MODE=strict to test exception throwing.');
  }

  try {
    getRequiredEnvVariable('THIS_VAR_DOES_NOT_EXIST');
  } catch (error) {
    log(`Successfully caught expected error: ${chalk.red(error.name)} - ${error.message}`);
  } finally {
    // Restore the original mode to be a good citizen
    if (originalValidationMode) {
      process.env.DAITAN_ENV_VALIDATION_MODE = originalValidationMode;
    }
  }
}

async function testHardware() {
  logTitle('Testing Hardware Information');
  log('Note: Some values may vary depending on your system.');

  log('\n[isTensorFlowSupported]');
  log(`Is TensorFlow likely supported on this CPU? ${isTensorFlowSupported()}`);

  log('\n[getMemoryInfo]');
  logObject(getMemoryInfo());

  log('\n[getOSInfo]');
  logObject(getOSInfo());
  
  log('\n[getNetworkInfo]');
  logObject(getNetworkInfo());
  
  log('\n[getLoadAverage]');
  logObject(getLoadAverage());

  log('\n[getCPUInfo] (async)');
  const cpuInfo = await getCPUInfo();
  logObject(cpuInfo);

  log('\n[getAllHardwareInfo] (comprehensive async report)');
  const allInfo = await getAllHardwareInfo();
  logObject(allInfo);
}

async function testGoogleAuth() {
  logTitle('Testing Google Auth Client');

  log('\n--- Attempt 1: Without environment variables (should fail) ---');
  try {
    getGoogleAuthClient();
  } catch (error) {
    log(`Successfully caught expected configuration error: ${chalk.red(error.name)}`);
  }

  log('\n--- Attempt 2: With dummy environment variables (should succeed) ---');
  process.env.GOOGLE_CLIENT_ID = 'dummy-client-id';
  process.env.GOOGLE_CLIENT_SECRET = 'dummy-client-secret';
  process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/oauth2callback';
  log('Set dummy GOOGLE_* environment variables.');

  try {
    const client = getGoogleAuthClient();
    log('Successfully initialized Google Auth Client:');
    logObject(client.constructor.name); // Should be OAuth2
    logObject(client._options);
  } catch (error) {
    log(`Caught unexpected error: ${chalk.red(error.name)} - ${error.message}`);
  }

  // Clean up dummy vars
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  delete process.env.GOOGLE_REDIRECT_URI;
}

async function testTools() {
    logTitle('Testing Developer Tools');
    devSimpleLog('This is a simple dev log.', true, 'info');
    devSimpleLog({ user: 'test', id: 123 }, true, 'dir', '[MyPrefix]');
    const result = devMultitestExample();
    log(`devMultitestExample (deprecated) returned: ${result}`);
}


/**
 * Main execution function.
 */
async function main() {
  log('Starting DaitanJS Development Package Test Suite...', chalk.bold.blue);
  setupTestEnvironment();

  try {
    await testLogger();
    await testEnvironment();
    await testGoogleAuth();
    await testTools();
    await testHardware(); // Run this last as it can be verbose
  } catch (error) {
    log(`A critical error occurred during the test suite: ${error.message}`, chalk.red);
    console.error(error);
  } finally {
    cleanupTestEnvironment();
    log('\nTest Suite Finished.', chalk.bold.blue);
  }
}

main();
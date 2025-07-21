// src/config/src/configManager.test.js
import {
  initializeConfigManager,
  getConfigManager,
  DaitanConfigManagerClass,
} from './configManager.js';

// More realistic mock that simulates the type-casting done by the real getOptionalEnvVariable
jest.mock('@daitanjs/development', () => ({
  getOptionalEnvVariable: jest.fn((key, defaultValue, options) => {
    // Simulate reading from a mock environment, falling back to the default
    const value =
      global.mockEnv && global.mockEnv[key] !== undefined
        ? global.mockEnv[key]
        : defaultValue;

    if (value === undefined) return undefined;

    // Simulate the type casting logic from the actual implementation
    switch (options.type) {
      case 'boolean':
        return String(value).toLowerCase() === 'true';
      case 'number':
        const num = parseFloat(value);
        return isNaN(num) ? defaultValue : num;
      default: // 'string'
        return String(value);
    }
  }),
  getLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    isLevelEnabled: jest.fn(),
  })),
}));

// We need to import the mocked function to inspect its calls
import { getOptionalEnvVariable } from '@daitanjs/development';

describe('ConfigManager', () => {
  // Reset the mock environment and the singleton instance before each test
  beforeEach(() => {
    global.mockEnv = {};
    jest.clearAllMocks();
    // Use forceReload to ensure we get a fresh instance that uses our mock setup for each test
    initializeConfigManager({ forceReload: true });
  });

  it('should initialize with default values if no environment variables are set', () => {
    const config = getConfigManager();
    expect(config).toBeInstanceOf(DaitanConfigManagerClass);

    // Test a few default values, expecting them to be correctly typed
    expect(config.get('NODE_ENV')).toBe('development');
    expect(config.get('LLM_PROVIDER')).toBe('openai');
    expect(config.get('RAG_PERSISTENT_STORE')).toBe(true); // 'true' string from defaults becomes boolean
    expect(config.get('LLM_MAX_RETRIES')).toBe(2); // '2' string from defaults becomes number
    expect(config.get('CHROMA_PORT')).toBe(8000); // '8000' string from defaults becomes number
  });

  it('should be a singleton, returning the same instance on subsequent calls without forceReload', () => {
    const instance1 = getConfigManager();
    const instance2 = getConfigManager();
    expect(instance1).toBe(instance2);
  });

  it('should be re-initialized if forceReload is true', () => {
    const instance1 = getConfigManager();

    // Simulate an env var being set for the next initialization
    global.mockEnv = { NODE_ENV: 'production' };

    const instance2 = initializeConfigManager({ forceReload: true });

    expect(instance1).not.toBe(instance2);
    expect(instance2.get('NODE_ENV')).toBe('production');
  });

  it('should override defaults with values from (mocked) environment variables', () => {
    // Configure the mock environment for this test
    global.mockEnv = {
      NODE_ENV: 'production',
      LLM_PROVIDER: 'anthropic',
      LLM_MAX_RETRIES: '5',
      RAG_PERSISTENT_STORE: 'false',
    };

    // Re-initialize to load the new "env vars" from our mock
    const config = initializeConfigManager({ forceReload: true });

    expect(config.get('NODE_ENV')).toBe('production');
    expect(config.get('LLM_PROVIDER')).toBe('anthropic');
    expect(config.get('LLM_MAX_RETRIES')).toBe(5); // Correctly typed as number
    expect(config.get('RAG_PERSISTENT_STORE')).toBe(false); // Correctly typed as boolean
    // Test a value that wasn't "set" in our mock env, should fall back to default
    expect(config.get('CHROMA_HOST')).toBe('localhost');
  });

  it('should return the provided defaultValue if a key is not found', () => {
    const config = getConfigManager();
    const value = config.get('NON_EXISTENT_KEY', 'my_default');
    expect(value).toBe('my_default');
  });

  it('should return undefined if a key is not found and no default is provided', () => {
    const config = getConfigManager();
    const value = config.get('NON_EXISTENT_KEY');
    expect(value).toBeUndefined();
  });

  it('should correctly infer and use the type from CONFIG_DEFAULTS when calling getOptionalEnvVariable', () => {
    // This test ensures the internal `_loadConfigData` loop passes the correct `type`
    // to the (mocked) getOptionalEnvVariable function.
    getConfigManager(); // Trigger initialization

    const calls = getOptionalEnvVariable.mock.calls;

    const nodeEnvCall = calls.find((call) => call[0] === 'NODE_ENV');
    expect(nodeEnvCall[2].type).toBe('string');

    const chromaPortCall = calls.find((call) => call[0] === 'CHROMA_PORT');
    expect(chromaPortCall[2].type).toBe('number');

    const ragStoreCall = calls.find(
      (call) => call[0] === 'RAG_PERSISTENT_STORE'
    );
    expect(ragStoreCall[2].type).toBe('boolean');

    const openApiKeyCall = calls.find((call) => call[0] === 'OPENAI_API_KEY');
    // The default is `undefined`, which our logic correctly infers should be treated as a string type.
    expect(openApiKeyCall[2].type).toBe('string');
  });
});

// packages/config/src/configManager.js (version 1.0.6)
/**
 * @file Centralized configuration management for the DaitanJS ecosystem.
 * @module @daitanjs/config/configManager
 */
import { getLogger, getOptionalEnvVariable } from '@daitanjs/development';

const CONFIG_DEFAULTS = {
  NODE_ENV: 'development',
  LOG_LEVEL: 'info',
  DEBUG_DOTENV: 'false',
  LOG_PATH: './logs',
  LOG_ENABLE_CONSOLE: 'true',
  LOG_LEVEL_CONSOLE: undefined,
  LOG_LEVEL_FILE: undefined,
  LLM_PROVIDER: 'openai',
  LLM_MODEL: undefined,
  OPENAI_API_KEY: undefined,
  ANTHROPIC_API_KEY: undefined,
  GROQ_API_KEY: undefined,
  OLLAMA_BASE_URL: 'http://localhost:11434',
  LLM_USE_CACHE: 'true',
  LLM_CACHE_CAPACITY: '200',
  LLM_TRACK_USAGE: 'true',
  LLM_MAX_RETRIES: '2',
  LLM_INITIAL_RETRY_DELAY_MS: '1000',
  LLM_REQUEST_TIMEOUT: '120000',
  DEFAULT_EXPERT_PROFILE: 'FAST_TASKER',
  EMBEDDING_USE_CACHE: 'true',
  EMBEDDING_CACHE_CAPACITY: '1000',
  LANGCHAIN_TRACING_V2: 'false',
  LANGCHAIN_API_KEY: undefined,
  LANGCHAIN_PROJECT: 'DaitanJS-Project',
  LANGCHAIN_ENDPOINT: 'https://api.smith.langchain.com',
  RAG_PERSISTENT_STORE: 'true',
  CHROMA_HOST: 'localhost',
  CHROMA_PORT: '8000',
  RAG_DEFAULT_COLLECTION_NAME: 'daitan_rag_default_store',
  B2_KEY_ID: undefined,
  B2_APPLICATION_KEY: undefined,
  B2_BUCKET_ID: undefined,
  CLOUDINARY_CLOUD_NAME: undefined,
  CLOUDINARY_API_KEY: undefined,
  CLOUDINARY_UPLOAD_PRESET: undefined,
  S3_BUCKET_NAME: undefined,
  AWS_REGION: undefined,
  AWS_ACCESS_KEY_ID: undefined,
  AWS_SECRET_ACCESS_KEY: undefined,
  FIREBASE_API_KEY: undefined,
  FIREBASE_AUTH_DOMAIN: undefined,
  FIREBASE_PROJECT_ID: undefined,
  FIREBASE_STORAGE_BUCKET: undefined,
  FIREBASE_MESSAGING_SENDER_ID: undefined,
  FIREBASE_APP_ID: undefined,
  FIREBASE_MEASUREMENT_ID: undefined,
  FIREBASE_ADMIN_CLIENT_EMAIL: undefined,
  FIREBASE_ADMIN_PRIVATE_KEY: undefined,
  FIREBASE_ADMIN_PRIVATE_KEY_ID: undefined,
  MAIL_SERVER_HOST: undefined,
  MAIL_SERVER_PORT: '587',
  MAIL_SMTP_USER: undefined,
  MAIL_SMTP_PASS: undefined,
  MAIL_FROM_ADDRESS: undefined,
  MAIL_RECIPIENT_OVERRIDE: undefined,
  TWILIO_ACCOUNTSID: undefined,
  TWILIO_AUTHTOKEN: undefined,
  TWILIO_SENDER: undefined,
  TWILIO_WHATSAPP_SENDER: undefined,
  STRIPE_SECRET_KEY: undefined,
  GOOGLE_API_KEY_SEARCH: undefined,
  GOOGLE_CSE_ID: undefined,
  MAPBOX_TOKEN: undefined,
  YOUTUBE_API_KEY: undefined,
  YT_DLP_PATH: 'yt-dlp',
  DEBUG_INTELLIGENCE: 'false',
  DEBUG_INTELLIGENCE_CONFIG: 'false',
  JWT_SECRET: undefined,
  ENCRYPTION_KEY: undefined,
  REDIS_URL: undefined,
  REDIS_HOST: 'localhost',
  REDIS_PORT: '6379',
  REDIS_PASSWORD: undefined,
};

let configManagerSingletonInstance = null;
let isConfigManagerInitialized = false;

class ConfigManager {
  constructor(loggerInstance) {
    this.configStore = {};
    this.logger = loggerInstance || getLogger('daitan-config-manager');
    this.isLoaded = false;
  }

  _loadConfigData() {
    this.logger.info(
      'Loading/Re-loading DaitanJS configurations from process.env...'
    );

    for (const key in CONFIG_DEFAULTS) {
      const defaultValue = CONFIG_DEFAULTS[key];
      let varType =
        typeof defaultValue === 'boolean'
          ? 'boolean'
          : typeof defaultValue === 'number'
          ? 'number'
          : 'string';
      if (defaultValue === 'true' || defaultValue === 'false')
        varType = 'boolean';
      else if (defaultValue !== undefined && !isNaN(Number(defaultValue)))
        varType = 'number';
      this.configStore[key] = getOptionalEnvVariable(key, defaultValue, {
        type: varType,
        loggerInstance: this.logger,
      });
    }
    this.isLoaded = true;
    this.logger.info('DaitanJS configuration values processed and stored.');
  }

  get(key, defaultValue = undefined) {
    const value = this.configStore[key];
    return value !== undefined ? value : defaultValue;
  }
}

export function initializeConfigManager(options = {}) {
  const { loggerInstance, forceReload = false } = options;
  const initLogger = loggerInstance || getLogger('daitan-config-manager');

  if (!configManagerSingletonInstance || forceReload) {
    initLogger.info(
      `${
        forceReload ? 'Re-initializing' : 'Initializing'
      } new ConfigManager instance...`
    );
    configManagerSingletonInstance = new ConfigManager(initLogger);
  } else {
    initLogger.info(
      'ConfigManager existed. Re-loading values to ensure freshness...'
    );
  }

  configManagerSingletonInstance._loadConfigData();

  isConfigManagerInitialized = true;
  initLogger.info('ConfigManager initialization/reload complete.');
  return configManagerSingletonInstance;
}

export function getConfigManager() {
  if (!isConfigManagerInitialized) {
    const localLogger = getLogger('daitan-config-manager');
    localLogger.warn(
      'getConfigManager() called before explicit init. Initializing now...'
    );
    return initializeConfigManager({ loggerInstance: localLogger });
  }
  return configManagerSingletonInstance;
}

export { ConfigManager as DaitanConfigManagerClass };
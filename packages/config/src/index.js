// packages/config/src/index.js
/**
 * @file Main entry point for the @daitanjs/config package.
 * @module @daitanjs/config
 *
 * @description
 * This package provides a centralized configuration management system for the DaitanJS
 * ecosystem. It exports the necessary functions to initialize and access the
 * singleton `ConfigManager`.
 *
 * For detailed documentation on how `ConfigManager` loads and processes configuration
 * (from environment variables and defaults), see `src/configManager.js`.
 *
 * @see {@link module:@daitanjs/config/configManager}
 */

export {
  getConfigManager,
  initializeConfigManager,
  DaitanConfigManagerClass, // Export the class for advanced use cases or testing
} from './configManager.js';

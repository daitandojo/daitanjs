// packages/development/src/logger.js (version 1.0.5 - Corrected)
import winston from 'winston';
import path from 'path';
import { getOptionalEnvVariable } from './environment.js';
import { inspect } from 'util';

export const DAITAN_LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
  silly: 4,
};

class _DaitanRootLogger {
  constructor() {
    this.loggers = new Map();
    this.isInitialized = false;
    this.globalLogPath = null;
    this.globalLogLevel = getOptionalEnvVariable('LOG_LEVEL', 'info');
  }

  initialize(options = {}) {
    const { logPath, logLevel } = options;
    if (logPath) {
      this.globalLogPath = logPath;
    }
    if (logLevel) {
      this.setGlobalLogLevel(logLevel);
    }
    this.isInitialized = true;
    console.log(`[DaitanLogger] Root logger initialized. Log Path: ${this.globalLogPath || 'Not Set (will use default ./logs)'}, Log Level: ${this.globalLogLevel}`);
  }

  setGlobalLogLevel(level) {
    if (!DAITAN_LOG_LEVELS.hasOwnProperty(level)) {
      console.error(`[DaitanLogger] Invalid log level provided: ${level}`);
      return;
    }
    this.globalLogLevel = level;
    for (const logger of this.loggers.values()) {
      logger.level = level;
      logger.transports.forEach(transport => {
        if (transport.filename && transport.filename.endsWith('errors.log')) {
          // Do not change the level of the dedicated error log file.
        } else {
          transport.level = level;
        }
      });
    }
  }

  isLogLevelEnabled(level, loggerLevel = null) {
    const targetLevel = loggerLevel || this.globalLogLevel;
    return DAITAN_LOG_LEVELS[level] <= DAITAN_LOG_LEVELS[targetLevel];
  }

  createLogger(category, options = {}) {
    const effectiveLogPath = options.logPath || this.globalLogPath || getOptionalEnvVariable('LOG_PATH', './logs');
    const effectiveLogLevel = this.globalLogLevel;

    const transports = [];

    const enableConsole = getOptionalEnvVariable('LOG_ENABLE_CONSOLE', 'true', {
        type: 'boolean',
    }) === true;

    if (enableConsole) {
      console.log(`[DaitanLogger internal] Creating console transport for category "${category}" with level "${effectiveLogLevel}".`);
      transports.push(
        new winston.transports.Console({
          // --- DEFINITIVE FIX: Use Winston's robust, built-in CLI formatter ---
          // This replaces the fragile custom printf formatter.
          format: winston.format.combine(
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            winston.format.ms(),
            winston.format.errors({ stack: true }),
            winston.format.splat(),
            winston.format.colorize(),
            winston.format.printf(({ level, message, timestamp, ms, ...meta }) => {
                const categoryStr = `[${category}]`;
                const metaStr = Object.keys(meta).length ? `\n${inspect(meta, { colors: true, depth: 3 })}` : '';
                return `${timestamp} ${level}:${categoryStr} ${message} ${ms}${metaStr}`;
            })
          ),
          level: effectiveLogLevel,
        })
      );
    } else {
      console.log(`[DaitanLogger internal] Console transport for "${category}" is DISABLED via LOG_ENABLE_CONSOLE.`);
    }
    
    const fileFormat = winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    );

    try {
      if (!path.isAbsolute(effectiveLogPath) && this.isInitialized) {
        console.error(`[DaitanLogger] Warning for category "${category}": Log path "${effectiveLogPath}" is not absolute.`);
      }
      // System Log
      transports.push(
        new winston.transports.File({
          filename: path.join(effectiveLogPath, `daitanjs_system.log`),
          format: fileFormat,
          maxsize: 10 * 1024 * 1024,
          maxFiles: 5,
          level: effectiveLogLevel,
        })
      );
      // Error Log
       transports.push(
         new winston.transports.File({
           filename: path.join(effectiveLogPath, `errors.log`),
           format: fileFormat,
           level: 'error',
           maxsize: 5 * 1024 * 1024,
           maxFiles: 3,
         })
       );
       console.log(`[DaitanLogger internal] File transports for "${category}" configured for path "${effectiveLogPath}".`);
    } catch (e) {
      console.error(
        `[DaitanLogger] CRITICAL: Failed to create file transport for category "${category}" in path "${effectiveLogPath}". Error: ${e.message}`
      );
    }

    const logger = winston.createLogger({
      level: effectiveLogLevel,
      levels: DAITAN_LOG_LEVELS,
      transports,
    });
    
    console.log(`[DaitanLogger internal] Logger created for category "${category}" with ${logger.transports.length} transports.`);
    this.loggers.set(category, logger);
    return logger;
  }

  getLogger(category = 'general', options = {}) {
    if (!this.loggers.has(category)) {
      return this.createLogger(category, options);
    }
    return this.loggers.get(category);
  }
}

const rootLoggerInstance = new _DaitanRootLogger();

export const initializeRootLogger = (options) => rootLoggerInstance.initialize(options);
export const getLogger = (category = 'general', options = {}) => rootLoggerInstance.getLogger(category, options);
export const setGlobalLogLevel = (level) => rootLoggerInstance.setGlobalLogLevel(level);
export const isLogLevelEnabled = (level, loggerLevel) => rootLoggerInstance.isLogLevelEnabled(level, loggerLevel);
export const DaitanRootLogger = rootLoggerInstance;
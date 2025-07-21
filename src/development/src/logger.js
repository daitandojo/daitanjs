// src/development/src/logger.js
import winston from 'winston';
import path from 'path';
import { getOptionalEnvVariable } from './environment.js';
import { inspect } from 'util';
import crypto from 'crypto';

// Maintain backward compatibility
export const LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug',
  SILLY: 'silly',
};

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
    // Initialize globalLogLevel directly from process.env
    this.globalLogLevel = getOptionalEnvVariable('LOG_LEVEL', 'info');
  }

  setGlobalLogLevel(level) {
    if (!DAITAN_LOG_LEVELS.hasOwnProperty(level)) {
      throw new Error(`Invalid log level: ${level}`);
    }
    this.globalLogLevel = level;

    for (const [name, logger] of this.loggers) {
      logger.level = level;
    }
  }

  isLogLevelEnabled(level, loggerLevel = null) {
    const targetLevel = loggerLevel || this.globalLogLevel;
    return DAITAN_LOG_LEVELS[level] <= DAITAN_LOG_LEVELS[targetLevel];
  }

  createLogger(category) {
    // Read config directly from environment variables.
    const logLevel = getOptionalEnvVariable('LOG_LEVEL', this.globalLogLevel);
    const logPath = getOptionalEnvVariable('LOG_PATH', './logs');
    const enableConsole =
      getOptionalEnvVariable('LOG_ENABLE_CONSOLE', 'true', {
        type: 'boolean',
      }) === true;

    const transports = [];

    if (enableConsole) {
      transports.push(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              const metaStr = Object.keys(meta).length
                ? inspect(meta, { colors: true, depth: 2 })
                : '';
              return `${timestamp} [${category}] ${level}: ${message} ${metaStr}`.trim();
            })
          ),
          level: logLevel,
        })
      );
    }

    const fileFormat = winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    );

    try {
      transports.push(
        new winston.transports.File({
          filename: path.join(logPath, `${category}.log`),
          format: fileFormat,
          maxsize: 10 * 1024 * 1024,
          maxFiles: 5,
          level: logLevel,
        })
      );
    } catch (e) {
      console.error(
        `[DaitanLogger] Failed to create file transport for category "${category}" in "${logPath}". Check permissions. Error: ${e.message}`
      );
    }

    const logger = winston.createLogger({
      level: logLevel,
      levels: DAITAN_LOG_LEVELS,
      transports,
      exceptionHandlers: [
        new winston.transports.File({
          filename: path.join(logPath, 'exceptions.log'),
        }),
      ],
      rejectionHandlers: [
        new winston.transports.File({
          filename: path.join(logPath, 'rejections.log'),
        }),
      ],
    });

    this.loggers.set(category, logger);
    return logger;
  }

  generateCorrelationId() {
    return crypto.randomBytes(8).toString('hex');
  }

  getLogger(category = 'general') {
    if (!this.loggers.has(category)) {
      this.createLogger(category);
    }
    return this.loggers.get(category);
  }

  getAllLoggers() {
    return Array.from(this.loggers.keys());
  }
}

const rootLoggerInstance = new _DaitanRootLogger();

// Backward compatibility exports
export const getLogger = (category = 'general') =>
  rootLoggerInstance.getLogger(category);
export const setGlobalLogLevel = (level) =>
  rootLoggerInstance.setGlobalLogLevel(level);
export const isLogLevelEnabled = (level, loggerLevel) =>
  rootLoggerInstance.isLogLevelEnabled(level, loggerLevel);
export const DaitanRootLogger = rootLoggerInstance;

// Default export for backward compatibility
export default rootLoggerInstance;

// Additional backward compatibility
export const createLogger = (category) =>
  rootLoggerInstance.getLogger(category);
export const getOrCreateLogger = (category) =>
  rootLoggerInstance.getLogger(category);

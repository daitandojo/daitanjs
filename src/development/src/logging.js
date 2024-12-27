import { createLogger, format, transports, addColors } from 'winston';
import path from 'path';

// Define custom colors for the different log levels
const customLevels = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    verbose: 4,
    debug: 5,
    silly: 6,
  },
  colors: {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    verbose: 'cyan',
    debug: 'blue',
    silly: 'grey',
  },
};

// Apply the custom colors to Winston
addColors(customLevels.colors);

// Initialize Winston logger
const logger = createLogger({
  level: 'info',
  levels: customLevels.levels,
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.splat(),
    format.json(),
  ),
  defaultMeta: { service: 'generic-service' },
  transports: [
    new transports.File({
      filename: path.resolve('logs', 'error.log'),
      level: 'error',
    }),
    new transports.File({ filename: path.resolve('logs', 'combined.log') }),
  ],
});

// Add console output for non-production environments with colorized format
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new transports.Console({
      level: 'debug',
      format: format.combine(
        format.colorize(), // Colorize the output
        format.printf(
          ({ timestamp, level, message, service, stack }) =>
            `${timestamp} [${service}] ${level}: ${message} ${stack ? `\n${stack}` : ''}`,
        ),
      ),
    }),
  );
}

class Logger {
  constructor(serviceName = 'generic-service') {
    this.logger = logger.child({ service: serviceName });
  }

  log(message, level = 'info') {
    const validLevels = [
      'error',
      'warn',
      'info',
      'http',
      'verbose',
      'debug',
      'silly',
    ];
    if (!validLevels.includes(level)) {
      console.warn(`Invalid log level: ${level}. Defaulting to 'info'.`);
      level = 'info';
    }
    this.logger.log(level, message);
  }

  error(message, error) {
    this.logger.error(message, { error: error?.message, stack: error?.stack });
  }

  warn(message) {
    this.logger.warn(message);
  }

  info(message) {
    this.logger.info(message);
  }

  debug(message) {
    this.logger.debug(message);
  }

  http(message) {
    this.logger.http(message);
  }

  verbose(message) {
    this.logger.verbose(message);
  }

  silly(message) {
    this.logger.silly(message);
  }
}

/**
 * Get a logger instance.
 * @param {string} serviceName - Name of the service using the logger.
 * @returns {Logger} Configured Logger instance.
 */
export function getLogger(serviceName = 'generic-service') {
  return createLogger({
      level: 'info',
      format: format.combine(
          format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          format.printf(({ timestamp, level, message }) => `${timestamp} [${serviceName}] ${level}: ${message}`)
      ),
      transports: [
          new transports.Console(),
          new transports.File({ filename: `${serviceName}.log` })
      ],
  });
};

// Export the Logger class for direct instantiation if needed
export { Logger };

// development/src/environment.js
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import os from 'os';
import {
  DaitanConfigurationError,
  DaitanInvalidInputError,
} from '@daitanjs/error';
import chalk from 'chalk';

const getPreLoadEnvVar = (key, defaultValue = null) => {
  const value = process.env[key];
  return value === undefined || value === null || String(value).trim() === ''
    ? defaultValue
    : String(value).trim();
};

export function loadEnvironmentFiles(options = {}) {
  const { envPath, overrideDotenv = true, debugDotenv = false } = options;

  const pathsAttemptedThisCall = new Set();

  const tryLoadSinglePath = (filePathToLoad, fileDescription) => {
    if (
      !filePathToLoad ||
      typeof filePathToLoad !== 'string' ||
      !filePathToLoad.trim()
    ) {
      return;
    }

    // This logic correctly handles the tilde `~` character
    const tildeExpandedPath = filePathToLoad.trim().replace(/^~/, os.homedir());
    const resolvedPath = path.resolve(tildeExpandedPath);

    if (pathsAttemptedThisCall.has(resolvedPath)) return;
    pathsAttemptedThisCall.add(resolvedPath);

    if (!fs.existsSync(resolvedPath)) {
      if (debugDotenv)
        console.log(
          `[DaitanEnvLoader] File not found for ${fileDescription}: "${resolvedPath}"`
        );
      return;
    }

    if (debugDotenv)
      console.log(
        `[DaitanEnvLoader] Attempting to load .env file: "${resolvedPath}" (${fileDescription})`
      );

    dotenv.config({
      path: resolvedPath,
      override: overrideDotenv,
      debug: debugDotenv,
    });
  };

  const effectiveDebug =
    debugDotenv || getPreLoadEnvVar('DEBUG_DOTENV') === 'true';
  if (effectiveDebug)
    console.log('[DaitanEnvLoader] Initiating .env file loading sequence...');

  const nodeEnv = getPreLoadEnvVar('NODE_ENV');
  const cwd = process.cwd();

  const fileLoadOrder = [
    {
      pathStr: getPreLoadEnvVar('DAITAN_GLOBAL_ENV_PATH'),
      description: 'Global DaitanJS Override via DAITAN_GLOBAL_ENV_PATH',
    },
    {
      pathStr: envPath,
      description: 'Explicit path from function options',
    },
    {
      pathStr: path.join(cwd, '.env'),
      description: 'Local Project (.env)',
    },
    {
      pathStr: path.join(cwd, '.env.local'),
      description: 'Local Project Override (.env.local)',
    },
    ...(nodeEnv
      ? [
          {
            pathStr: path.join(cwd, `.env.${nodeEnv}`),
            description: `Local Project (.env.${nodeEnv})`,
          },
          {
            pathStr: path.join(cwd, `.env.${nodeEnv}.local`),
            description: `Local Project Override (.env.${nodeEnv}.local)`,
          },
        ]
      : []),
  ];

  fileLoadOrder.forEach(({ pathStr, description }) => {
    if (pathStr) {
      tryLoadSinglePath(pathStr, description);
    }
  });

  if (effectiveDebug)
    console.log('[DaitanEnvLoader] .env file loading sequence complete.');
}

export const getEnvVariable = (key, defaultValue, options = {}) => {
  const { isRequired = false, type = 'string', description = '' } = options;
  if (!key || typeof key !== 'string' || !key.trim()) {
    throw new DaitanInvalidInputError(
      'Environment variable key must be a non-empty string.'
    );
  }
  const trimmedKey = key.trim();
  const rawValue = process.env[trimmedKey];
  const valueString =
    rawValue === undefined || rawValue === null ? '' : String(rawValue).trim();
  const isMissingOrEmpty = valueString === '';

  if (isMissingOrEmpty) {
    if (isRequired) {
      const errorMsg = `Missing required environment variable: ${trimmedKey}. Description: ${
        description || 'N/A'
      }`;
      if (process.env.DAITAN_ENV_VALIDATION_MODE === 'strict') {
        console.error(chalk.red.bold(`\nFATAL: ${errorMsg}\n`));
        process.exit(1);
      }
      throw new DaitanConfigurationError(errorMsg, { key: trimmedKey });
    }
    return defaultValue;
  }

  try {
    switch (type) {
      case 'number':
        const num = parseFloat(valueString);
        if (isNaN(num))
          throw new Error(`Value "${valueString}" is not a valid number.`);
        return num;
      case 'boolean':
        const lowerValue = valueString.toLowerCase();
        if (['true', '1', 'yes', 'on'].includes(lowerValue)) return true;
        if (['false', '0', 'no', 'off'].includes(lowerValue)) return false;
        throw new Error(`Value "${valueString}" is not a valid boolean.`);
      case 'array':
        return valueString
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
      default:
        return valueString;
    }
  } catch (castError) {
    const errorMsg = `Environment variable ${trimmedKey} ("${valueString}") could not be cast to type "${type}": ${castError.message}`;
    if (isRequired) {
      if (process.env.DAITAN_ENV_VALIDATION_MODE === 'strict') {
        console.error(chalk.red.bold(`\nFATAL: ${errorMsg}\n`));
        process.exit(1);
      }
      throw new DaitanConfigurationError(errorMsg);
    }
    return defaultValue;
  }
};

export const getRequiredEnvVariable = (
  key,
  type = 'string',
  description = ''
) => getEnvVariable(key, undefined, { isRequired: true, type, description });
export const getOptionalEnvVariable = (key, defaultValue, options = {}) =>
  getEnvVariable(key, defaultValue, { isRequired: false, ...options });
export const checkEnv = (variableName) =>
  !!getOptionalEnvVariable(variableName);

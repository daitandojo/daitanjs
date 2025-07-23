// cli/src/commands/config.js
/**
 * @file Registers the 'config' command for the DaitanJS CLI.
 * @module @daitanjs/cli/commands/config
 *
 * @description
 * This module defines the command for inspecting the currently resolved
 * configuration of the DaitanJS ecosystem as seen by the CLI. It uses the
 * canonical `ConfigManager` from `@daitanjs/config` to get and display the values.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { getLogger } from '@daitanjs/development';
import { getConfigManager } from '@daitanjs/config';

const logger = getLogger('daitan-cli-config');

/**
 * Registers the 'config' command to the main program.
 * @param {Command} program - The main commander program instance.
 */
export function registerConfigCommands(program) {
  const configCommand = program
    .command('config')
    .description(chalk.cyan('View the current DaitanJS configuration values.'))
    .action(() => {
      logger.info(
        "Executing 'config' command to display current configuration."
      );
      console.log(chalk.green.bold('DaitanJS Effective Configuration\n'));
      console.log(
        chalk.dim(
          'The following values are resolved from environment variables and internal defaults.'
        )
      );
      console.log(
        chalk.dim(
          'Sensitive values like API keys and secrets are masked for security.'
        )
      );
      console.log(
        chalk.dim(
          '----------------------------------------------------------------'
        )
      );

      try {
        const configManager = getConfigManager();
        // The configManager is initialized in the preAction hook of the main CLI index.

        // We get the full, unmasked store to work with
        const fullConfig = configManager.configStore;

        // Manually mask and format for CLI output
        const sensitiveKeyPatterns = [
          'KEY',
          'TOKEN',
          'SECRET',
          'PASSWORD',
          'PASS',
        ];
        const output = {};

        // Sort keys for consistent output
        const sortedKeys = Object.keys(fullConfig).sort();

        for (const key of sortedKeys) {
          const value = fullConfig[key];
          if (value === undefined || value === null) {
            output[key] = chalk.gray('<not set>');
            continue;
          }

          if (
            sensitiveKeyPatterns.some((pattern) =>
              key.toUpperCase().includes(pattern)
            )
          ) {
            if (typeof value === 'string' && value.length > 4) {
              output[key] = chalk.yellow('********' + String(value).slice(-4));
            } else if (value) {
              output[key] = chalk.yellow('********');
            } else {
              output[key] = chalk.gray('<not set>');
            }
          } else {
            if (typeof value === 'boolean') {
              output[key] = chalk.magenta(value);
            } else if (typeof value === 'number') {
              output[key] = chalk.blue(value);
            } else {
              output[key] = chalk.white(value);
            }
          }
        }

        // Pretty print the object to the console
        for (const [key, value] of Object.entries(output)) {
          const paddedKey = key.padEnd(35, ' ');
          console.log(`${chalk.cyan(paddedKey)}: ${value}`);
        }
      } catch (error) {
        logger.error('Error retrieving configuration:', error);
        console.error(
          chalk.red.bold(
            '\nAn error occurred while trying to display the configuration:'
          )
        );
        console.error(chalk.red(error.message));
      }
    });
}

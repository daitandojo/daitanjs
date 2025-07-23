#!/usr/bin/env node
// cli/src/index.js
/**
 * @file Main entry point for the DaitanJS Command-Line Interface.
 * @module @daitanjs/cli
 *
 * @description
 * This file initializes the CLI application using the 'commander' library.
 * It sets up the main program, defines global options, and registers all
 * available commands from the `./commands` directory.
 *
 * Each command is defined in its own module and is responsible for its
 * specific options, arguments, and action handler. This modular approach
 * keeps the CLI codebase organized and easy to extend.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { getLogger, loadEnvironmentFiles } from '@daitanjs/development';
import { initializeConfigManager } from '@daitanjs/config';

// Import all command registration functions
import { registerAiCommands } from './commands/ai.js';
import { registerRagCommands } from './commands/rag.js';
import { registerConfigCommands } from './commands/config.js';
import { registerCheckCommands } from './commands/check.js'; // <<<--- UNCOMMENTED THIS LINE
import { registerGeoCommands } from './commands/geo.js';
import { registerSpeechCommands } from './commands/speech.js';
import { registerImageCommands } from './commands/images.js';
import { registerSecurityCommands } from './commands/security.js';
import { registerInitCommands } from './commands/init.js';
import { registerDataCommands } from './commands/data.js';
import { registerCommCommands } from './commands/communication.js';
import { registerSensesCommands } from './commands/senses.js';
import { registerMediaCommands } from './commands/media.js';
import { registerQueueCommands } from './commands/queue.js';
import { registerWorkerCommands } from './commands/worker.js';

// Initialize the main 'program' object from commander
const program = new Command();

// --- Main Program Setup ---
program
  .name('daitan')
  .description(
    chalk.blue.bold(
      'A comprehensive command-line interface for the DaitanJS ecosystem.'
    )
  )
  .version('1.0.0', '-v, --version', 'Output the current version')
  .option('-e, --env <path>', 'Specify a custom path to a .env file to load')
  .option(
    '--verbose',
    'Enable verbose logging for the command execution',
    false
  )
  .hook('preAction', async (thisCommand, actionCommand) => {
    // This hook runs before any action handler. We skip it for the 'init' command.
    if (actionCommand.name() === 'init') {
      return;
    }

    const options = thisCommand.opts();

    // Set global verbosity flag for other modules to potentially access
    if (options.verbose) {
      process.env.DAITAN_CLI_VERBOSE = 'true';
    }

    // Load environment files. The custom path from --env takes precedence.
    const logger = getLogger('daitan-cli-main');
    logger.info(chalk.yellow('Initializing DaitanJS environment...'));

    loadEnvironmentFiles({
      envPath: options.env,
      debugDotenv: options.verbose,
      loggerInstance: logger,
      override: true, // Let CLI flags override .env files
    });

    // Initialize the master configuration for all DaitanJS packages
    initializeConfigManager({ loggerInstance: logger });

    logger.info(chalk.green('Environment ready. Executing command...'));
    console.log(
      chalk.dim(
        '----------------------------------------------------------------'
      )
    );
  });

// --- Register All Command Modules ---
registerAiCommands(program);
registerRagCommands(program);
registerConfigCommands(program);
registerCheckCommands(program); // <<<--- UNCOMMENTED THIS LINE
registerGeoCommands(program);
registerSpeechCommands(program);
registerImageCommands(program);
registerSecurityCommands(program);
registerInitCommands(program);
registerDataCommands(program);
registerCommCommands(program);
registerSensesCommands(program);
registerMediaCommands(program);
registerQueueCommands(program);
registerWorkerCommands(program);

// --- Default Behavior & Error Handling ---
program.on('command:*', (operands) => {
  console.error(
    chalk.red(
      `Invalid command: ${operands[0]}\nSee --help for a list of available commands.`
    )
  );
  process.exit(1);
});

// If no command is specified, show help.
if (process.argv.length <= 2) {
  program.outputHelp();
}

/**
 * Main execution function.
 */
async function main() {
  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    const logger = getLogger('daitan-cli-fatal');
    logger.error('A fatal error occurred in the CLI application:', error);
    console.error(chalk.red.bold('\nFATAL ERROR:'), chalk.red(error.message));
    if (process.env.DAITAN_CLI_VERBOSE === 'true') {
      console.error(chalk.dim(error.stack));
    }
    process.exit(1);
  }
}

// Only run main if this script is executed directly
if (
  import.meta.url.startsWith('file://') &&
  process.argv[1] === import.meta.url.slice(7)
) {
  main();
}

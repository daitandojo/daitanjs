// File: src/cli/src/commands/worker.js

import { Command } from 'commander';
import chalk from 'chalk';
import { startWorkers } from '@daitanjs/queues';
import { getLogger } from '@daitanjs/development';

const logger = getLogger('daitan-cli-worker');

/**
 * Registers the 'worker' command to the main program.
 * @param {Command} program - The main commander program instance.
 */
export function registerWorkerCommands(program) {
  const workerCommand = program
    .command('worker')
    .description(chalk.cyan('Manage and run background job workers.'));

  workerCommand
    .command('start')
    .description('Start worker processes to listen to all known queues.')
    .option(
      '-q, --queue <name>',
      'Optional: Start a worker for only a specific queue.'
    )
    .action(async (options) => {
      try {
        await startWorkers({ specificQueue: options.queue });
      } catch (error) {
        logger.error('Failed to start DaitanJS workers.', error);
        process.exit(1);
      }
    });
}

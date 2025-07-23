// cli/src/commands/queue.js
/**
 * @file Registers the 'queue' command for interacting with BullMQ job queues.
 * @module @daitanjs/cli/commands/queue
 *
 * @description
 * This module provides a CLI command to launch a web dashboard for monitoring
 * and managing the BullMQ job queues used by the DaitanJS ecosystem.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import express from 'express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter.js';
import { ExpressAdapter } from '@bull-board/express';
import { createQueue } from '@daitanjs/queues';
import { getLogger } from '@daitanjs/development';

const logger = getLogger('daitan-cli-queue');

// List of known queue names used in the DaitanJS ecosystem.
// This could be dynamically discovered in a more advanced setup.
const KNOWN_QUEUES = ['mail-queue'];

/**
 * Registers the 'queue' command and its subcommands to the main program.
 * @param {Command} program - The main commander program instance.
 */
export function registerQueueCommands(program) {
  const queueCommand = program
    .command('queue')
    .description(
      chalk.cyan('Interact with and monitor background job queues.')
    );

  // --- Queue Dashboard Subcommand ---
  queueCommand
    .command('dashboard')
    .description('Launch a web dashboard to monitor all known job queues.')
    .option(
      '-p, --port <port>',
      'The port to run the dashboard on.',
      (val) => parseInt(val, 10),
      4000
    )
    .action(async (options) => {
      const verbose = program.opts().verbose;
      const spinner = ora(chalk.blue('Setting up queue dashboard...')).start();

      try {
        const app = express();
        const serverAdapter = new ExpressAdapter();
        serverAdapter.setBasePath('/ui');

        const queueAdapters = KNOWN_QUEUES.map((queueName) => {
          logger.info(`Creating adapter for queue: "${queueName}"`);
          // `createQueue` from @daitanjs/queues will create or get the BullMQ queue instance
          const queue = createQueue(queueName);
          return new BullMQAdapter(queue);
        });

        if (queueAdapters.length === 0) {
          spinner.warn(chalk.yellow('No known queues to monitor.'));
          return;
        }

        createBullBoard({
          queues: queueAdapters,
          serverAdapter: serverAdapter,
        });

        app.use('/ui', serverAdapter.getRouter());

        app.listen(options.port, () => {
          spinner.succeed(chalk.green.bold('Queue Dashboard is running!'));
          console.log(
            `${chalk.cyan('URL:')} ${chalk.white.underline(
              `http://localhost:${options.port}/ui`
            )}`
          );
          console.log(chalk.gray('\nPress Ctrl+C to stop the server.'));
        });
      } catch (error) {
        spinner.fail(chalk.red('Failed to start the queue dashboard.'));
        logger.error(`Error during 'queue dashboard' command:`, error);
        console.error(chalk.red.bold(error.message));
        if (verbose) {
          console.error(chalk.dim(error.stack));
        }
      }
    });
}

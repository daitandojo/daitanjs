// cli/src/commands/communication.js
/**
 * @file Registers the 'comm' command for sending test communications.
 * @module @daitanjs/cli/commands/communication
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { getLogger } from '@daitanjs/development';
import { sendMail, sendSMS } from '@daitanjs/communication';

const logger = getLogger('daitan-cli-comm');

/**
 * Registers the 'comm' (communication) command and its subcommands to the main program.
 * @param {Command} program - The main commander program instance.
 */
export function registerCommCommands(program) {
  const commCommand = program
    .command('comm')
    .description(
      chalk.cyan('Send test communications like emails and SMS messages.')
    );

  // --- Comm Send-Email Subcommand ---
  commCommand
    .command('send-email')
    .description('Send a test email using the configured SMTP provider.')
    .requiredOption('--to <email>', 'The recipient email address.')
    .requiredOption('--subject <subject>', 'The subject of the email.')
    .requiredOption('--body <html>', 'The HTML body content of the email.')
    .action(async (options) => {
      const verbose = program.opts().verbose;
      const spinner = ora(
        chalk.blue(`Sending test email to "${options.to}"...`)
      ).start();

      try {
        // Use the new single-parameter object API for sendMail
        const job = await sendMail({
          message: {
            to: options.to,
            subject: options.subject,
            html: options.body,
          },
          // No specific config needed, will use environment variables
        });

        spinner.succeed(
          chalk.green.bold('Test email has been successfully queued!')
        );
        console.log(`${chalk.cyan('Job ID:')} ${chalk.white(job.id)}`);
        console.log(
          chalk.yellow(
            'Note: This confirms the job was added to the queue. A separate worker process must be running to actually send the email.'
          )
        );
      } catch (error) {
        spinner.fail(chalk.red('Failed to queue the test email.'));
        logger.error(`Error during 'comm send-email' command:`, error);
        console.error(chalk.red.bold(error.message));
        if (verbose) {
          console.error(chalk.dim(error.stack));
        }
      }
    });

  // --- Comm Send-SMS Subcommand ---
  commCommand
    .command('send-sms')
    .description('Send a test SMS using the configured Twilio provider.')
    .requiredOption(
      '--to <phoneNumber>',
      'The recipient phone number in E.164 format (e.g., +15551234567).'
    )
    .requiredOption('--message <text>', 'The text message to send.')
    .action(async (options) => {
      const verbose = program.opts().verbose;
      const spinner = ora(
        chalk.blue(`Sending test SMS to "${options.to}"...`)
      ).start();

      try {
        // sendSMS already uses a single-parameter object, so no change is needed here.
        const messageSid = await sendSMS({
          recipient: options.to,
          messageBody: options.message,
        });

        spinner.succeed(chalk.green.bold('Test SMS sent successfully!'));
        console.log(
          `${chalk.cyan('Twilio Message SID:')} ${chalk.white(messageSid)}`
        );
      } catch (error) {
        spinner.fail(chalk.red('Failed to send the test SMS.'));
        logger.error(`Error during 'comm send-sms' command:`, error);
        console.error(chalk.red.bold(error.message));
        if (verbose) {
          console.error(chalk.dim(error.stack));
        }
      }
    });
}

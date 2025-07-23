// cli/src/commands/security.js
/**
 * @file Registers the 'security' command for token generation and other security utilities.
 * @module @daitanjs/cli/commands/security
 */
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { getLogger, getRequiredEnvVariable } from '@daitanjs/development';
import { generateJWT } from '@daitanjs/security';
import { DaitanInvalidInputError } from '@daitanjs/error';

const logger = getLogger('daitan-cli-security');

/** @private */
const parseCliJson = (str) => {
  try {
    const correctedStr = str.replace(/'/g, '"');
    return JSON.parse(correctedStr);
  } catch (e) {
    throw new DaitanInvalidInputError(
      `Invalid JSON format for payload. Error: ${e.message}`
    );
  }
};

/**
 * Registers the 'security' command and its subcommands.
 * @param {Command} program
 */
export function registerSecurityCommands(program) {
  const securityCommand = program
    .command('security')
    .description(
      chalk.cyan('Perform security-related tasks like token generation.')
    );

  securityCommand
    .command('generate-token')
    .alias('jwt')
    .description('Generate a JSON Web Token (JWT).')
    .requiredOption(
      '-p, --payload <json>',
      'The JSON payload for the token as a string (e.g., \'{"userId":"abc"}\').'
    )
    .option(
      '-s, --secret <key>',
      'The secret key. Defaults to JWT_SECRET environment variable.'
    )
    .option(
      '-e, --expires-in <duration>',
      'Token expiration (e.g., "1h", "7d", "365d").',
      '1h'
    )
    .action((options) => {
      const verbose = program.opts().verbose;
      const spinner = ora(chalk.blue('Generating JWT...')).start();

      try {
        const payload = parseCliJson(options.payload);
        const secret =
          options.secret ||
          getRequiredEnvVariable('JWT_SECRET', 'string', 'JWT signing secret');

        // Use the new single-parameter object API
        const token = generateJWT({
          payload,
          secretOrPrivateKey: secret,
          options: { expiresIn: options.expiresIn },
        });

        spinner.succeed(chalk.green.bold('JWT generated successfully!'));
        console.log(
          chalk.dim(
            '----------------------------------------------------------------'
          )
        );
        console.log(chalk.cyan(token));
        console.log(
          chalk.dim(
            '----------------------------------------------------------------'
          )
        );
        if (verbose) {
          console.log(chalk.yellow.bold('\nToken Details:'));
          console.log(`${chalk.cyan('Payload:')}`, payload);
          console.log(`${chalk.cyan('Expires In:')} ${options.expiresIn}`);
        }
      } catch (error) {
        spinner.fail(chalk.red('Token generation failed.'));
        logger.error(`Error during 'security generate-token' command:`, error);
        console.error(chalk.red.bold(error.message));
      }
    });
}

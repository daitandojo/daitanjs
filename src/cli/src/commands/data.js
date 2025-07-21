// cli/src/commands/data.js
/**
 * @file Registers the 'data' command for the DaitanJS CLI.
 * @module @daitanjs/cli/commands/data
 *
 * @description
 * This module defines commands for interacting with the data management utilities
 * from the `@daitanjs/data` package. It provides CLI access to query local
 * CSV "tables" and line-delimited JSON stores.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { getLogger } from '@daitanjs/development';
import { CSVSQL, jsonQuery } from '@daitanjs/data';
import { DaitanInvalidInputError } from '@daitanjs/error';

const logger = getLogger('daitan-cli-data');

/**
 * Registers the 'data' command and its subcommands to the main program.
 * @param {Command} program - The main commander program instance.
 */
export function registerDataCommands(program) {
  const dataCommand = program
    .command('data')
    .description(
      chalk.cyan('Interact with local data stores like CSV and JSON files.')
    );

  // --- CSVSQL Subcommand ---
  dataCommand
    .command('query <sql>')
    .description('Execute a simplified SQL query on a directory of CSV files.')
    .option(
      '--dir <path>',
      'Specify the directory containing the CSV files (tables). Defaults to the configured CSVSQL path.'
    )
    .action(async (sql, options) => {
      const verbose = program.opts().verbose;
      const spinner = ora(chalk.blue('Executing CSVSQL query...')).start();

      try {
        const csvSql = new CSVSQL(options.dir, { verbose });
        await csvSql.initialize(); // Ensure directory is ready and tables are preloaded

        spinner.text = chalk.blue(`Executing: "${sql.substring(0, 50)}..."`);
        const result = await csvSql.query(sql);

        spinner.succeed(chalk.green.bold('Query executed successfully.'));
        console.log(
          chalk.dim(
            '----------------------------------------------------------------'
          )
        );

        if (Array.isArray(result) && result.length > 0) {
          // console.table is great for structured data
          console.table(result);
        } else if (Array.isArray(result)) {
          console.log(chalk.yellow('Query returned no results.'));
        } else {
          // For INSERT/DELETE results
          console.log(chalk.cyan(JSON.stringify(result, null, 2)));
        }
      } catch (error) {
        spinner.fail(chalk.red('CSVSQL query failed.'));
        logger.error(`Error during 'data query' command:`, error);
        console.error(chalk.red.bold(error.message));
        if (verbose && error.stack) {
          console.error(chalk.dim(error.stack));
        }
      }
    });

  // --- JSON Store Query Subcommand ---
  dataCommand
    .command('json-query <jsonQuery>')
    .description(
      'Query a line-delimited JSON store file using a JSON query object.'
    )
    .option(
      '--file <path>',
      'Specify the path to the JSON store file. Defaults to the configured jsonstore path.'
    )
    .action(async (jsonQueryString, options) => {
      const verbose = program.opts().verbose;
      const spinner = ora(chalk.blue('Executing JSON store query...')).start();

      try {
        let queryObject;
        try {
          queryObject = JSON.parse(jsonQueryString);
        } catch (e) {
          throw new DaitanInvalidInputError(
            `Invalid JSON format for query string. Error: ${e.message}`
          );
        }

        spinner.text = chalk.blue(
          `Querying with: "${jsonQueryString.substring(0, 50)}..."`
        );
        const results = await jsonQuery({
          query: queryObject,
          filePath: options.file,
        });

        spinner.succeed(chalk.green.bold('JSON query executed successfully.'));
        console.log(
          chalk.dim(
            '----------------------------------------------------------------'
          )
        );

        if (results.length > 0) {
          console.log(chalk.cyan(JSON.stringify(results, null, 2)));
        } else {
          console.log(chalk.yellow('Query returned no matching objects.'));
        }
      } catch (error) {
        spinner.fail(chalk.red('JSON store query failed.'));
        logger.error(`Error during 'data json-query' command:`, error);
        console.error(chalk.red.bold(error.message));
        if (verbose && error.stack) {
          console.error(chalk.dim(error.stack));
        }
      }
    });
}